import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

const isTauri = (): boolean => '__TAURI_INTERNALS__' in window;

const REFRESH_INTERVAL_MS = 10 * 60 * 1000; // 10 分钟

export function useWeather(lat: number, lon: number) {
  const [weather, setWeather] = useState<string>('☁|--°C');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    // 隐私保护:坐标为 0,0(默认占位)时不发起请求,等待用户在设置中选择城市
    const isPlaceholder = lat === 0 && lon === 0;

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
        const result = await invoke<string>('get_weather', { lat, lon });
        if (!cancelled) setWeather(result);
      } catch (e) {
        console.error('Failed to fetch weather:', e);
        if (!cancelled) setWeather('☁|--°C');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchWeather();
    // 仅在已设置位置时启动轮询
    const interval = isPlaceholder ? null : window.setInterval(fetchWeather, REFRESH_INTERVAL_MS);
    return () => {
      cancelled = true;
      if (interval !== null) window.clearInterval(interval);
    };
  }, [lat, lon]);

  return { weather, loading };
}
