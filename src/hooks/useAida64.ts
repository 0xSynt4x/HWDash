import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';

const isTauri = (): boolean => '__TAURI_INTERNALS__' in window;

export type Aida64Data = Record<string, string>;

const TICK_INTERVAL_MS = 1000;

/**
 * 同时驱动:1) AIDA64 注册表读取 2) 时钟更新
 * 合并为单个 1Hz tick,减少 React state 更新次数(批处理后通常 1 次 commit)。
 */
export function useAida64() {
  const [aida, setAida] = useState<Aida64Data>({});
  const [time, setTime] = useState(() => new Date());
  const [status, setStatus] = useState('Waiting for AIDA64...');

  useEffect(() => {
    let cancelled = false;

    const tick = async () => {
      if (cancelled) return;
      // 时钟总是更新
      setTime(new Date());

      // 硬件数据仅在 Tauri 环境下读取
      if (!isTauri()) {
        setStatus('Browser mode (No AIDA64)');
        return;
      }

      try {
        const rawData = await invoke<Aida64Data>('get_hardware_data');
        if (cancelled) return;
        if (rawData && Object.keys(rawData).length > 0) {
          setAida(rawData);
          setStatus('Connected to AIDA64');
        } else {
          setStatus('Registry empty. Is AIDA64 writing to it?');
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
    (key: string, fallback = '0'): string => aida[`Value.${key}`] ?? aida[key] ?? fallback,
    [aida]
  );

  const getNum = useCallback(
    (key: string): number => {
      const raw = aida[`Value.${key}`] ?? aida[key];
      if (raw === undefined || raw === null) return 0;
      const n = parseFloat(raw);
      return Number.isFinite(n) ? n : 0;
    },
    [aida]
  );

  return { aida, time, status, getStr, getNum };
}
