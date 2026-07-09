import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';

const isTauri = (): boolean => '__TAURI_INTERNALS__' in window;

export type HardwareData = Record<string, string>;

const TICK_INTERVAL_MS = 1000;

/**
 * 驱动硬件数据读取(通过 LibreHardwareMonitor Sidecar)与时钟更新
 * 合并为单个 1Hz tick,减少 React state 更新次数
 */
export function useHardware() {
  const [hwData, setHwData] = useState<HardwareData>({});
  const [time, setTime] = useState(() => new Date());
  const [status, setStatus] = useState('Connecting...');

  useEffect(() => {
    let cancelled = false;

    const tick = async () => {
      if (cancelled) return;
      // 时钟总是更新
      setTime(new Date());

      // 硬件数据仅在 Tauri 环境下读取
      if (!isTauri()) {
        setStatus('Browser mode (No Hardware)');
        return;
      }

      try {
        const rawData = await invoke<HardwareData>('get_hardware_data');
        if (cancelled) return;
        if (rawData && Object.keys(rawData).length > 0) {
          setHwData(rawData);
          setStatus('Connected');
        } else {
          setStatus('No sensor data. Is Sidecar running?');
        }
      } catch (e) {
        if (cancelled) return;
        setStatus(`Error: ${String(e)}`);
      }
    };

    // 立即执行一次,后续每秒
    tick();
    const timer = window.setInterval(tick, TICK_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const getStr = useCallback(
    (key: string, fallback = '0'): string =>
      hwData[`Value.${key}`] ?? hwData[key] ?? fallback,
    [hwData]
  );

  const getNum = useCallback(
    (key: string): number => {
      const raw = hwData[`Value.${key}`] ?? hwData[key];
      if (raw === undefined || raw === null) return 0;
      const n = parseFloat(raw);
      return Number.isFinite(n) ? n : 0;
    },
    [hwData]
  );

  return { hwData, time, status, getStr, getNum };
}
