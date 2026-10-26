import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

const isTauri = (): boolean => '__TAURI_INTERNALS__' in window;

const REFRESH_INTERVAL_MS = 10 * 60 * 1000; // 10 分钟

export function useWeather(province: string, city: string) {
  const [weather, setWeather] = useState<string>('☁|--°C');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    // 未配置省市时不发起请求(相当于原来的"坐标占位"保护)
    const isPlaceholder = !province || !city;

    const fetchWeather = async () => {
      try {
        if (!isTauri()) {
          if (!cancelled) setWeather('☀|25°C');
          return;
        }
        if (isPlaceholder) {
          if (!cancelled) setWeather('☁|--°C');
          return;
        }
        const result = await invoke<string>('get_weather', { province, city });
        if (!cancelled) setWeather(result);
      } catch (e) {
        console.error('Failed to fetch weather:', e);
        if (!cancelled) setWeather('☁|--°C');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchWeather();
    // 仅在已配置省市时启动轮询
    const interval = isPlaceholder ? null : window.setInterval(fetchWeather, REFRESH_INTERVAL_MS);
    return () => {
      cancelled = true;
      if (interval !== null) window.clearInterval(interval);
    };
  }, [province, city]);

  return { weather, loading };
}
