import { useEffect, useRef, useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';

export type Theme = 'dark' | 'light' | 'tesla' | 'ferrari';
export type Layout = 'vertical' | 'horizontal';

export interface AppSettings {
  theme: Theme;
  layout: Layout;
  zoom: number;
  cpu_name: string;
  gpu_name: string;
  network_name: string;
  nic_index: number;
  latitude: number;
  longitude: number;
  location_name: string;
}

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  layout: 'vertical',
  zoom: 1,
  cpu_name: 'AMD RYZEN 7 9800X3D',
  gpu_name: 'INNO3D RTX 5070 TI',
  network_name: 'NETWORK',
  nic_index: -1,
  latitude: 43.8,
  longitude: 87.6,
  location_name: 'Urumqi',
};

const isTauri = (): boolean => '__TAURI_INTERNALS__' in window;

/**
 * 设置 hook:启动时从便携 settings.json 读取,变更时去抖写回。
 * 浏览器调试模式下退化为内存态(不持久化)。
 *
 * 关键约束:
 * - 仅在用户/程序通过 update/updateMany 修改后才写回(dirtyRef),避免启动时把刚读到的内容再回写一遍。
 */
export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);
  const writeTimer = useRef<number | null>(null);
  const dirtyRef = useRef(false);

  // 启动时加载
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!isTauri()) {
        setLoaded(true);
        return;
      }
      try {
        const remote = await invoke<AppSettings>('read_settings');
        if (!cancelled) {
          setSettings({ ...DEFAULT_SETTINGS, ...remote });
        }
      } catch (e) {
        console.error('Failed to read settings:', e);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // 去抖写回:仅当 dirtyRef 为真时执行
  useEffect(() => {
    if (!loaded || !isTauri() || !dirtyRef.current) return;
    if (writeTimer.current !== null) {
      window.clearTimeout(writeTimer.current);
    }
    writeTimer.current = window.setTimeout(() => {
      invoke('write_settings', { settings }).catch((e) =>
        console.error('Failed to write settings:', e)
      );
    }, 300);
    return () => {
      if (writeTimer.current !== null) {
        window.clearTimeout(writeTimer.current);
      }
    };
  }, [settings, loaded]);

  const update = useCallback(<K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings((prev) => {
      if (prev[key] === value) return prev;
      dirtyRef.current = true;
      return { ...prev, [key]: value };
    });
  }, []);

  const updateMany = useCallback((patch: Partial<AppSettings>) => {
    setSettings((prev) => {
      dirtyRef.current = true;
      return { ...prev, ...patch };
    });
  }, []);

  return { settings, loaded, update, updateMany };
}
