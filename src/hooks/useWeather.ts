import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

export function useWeather() {
  const [weather, setWeather] = useState<string>('☁|--°C');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchWeather = async () => {
      try {
        const result = await invoke<string>('get_weather');
        setWeather(result);
      } catch (e) {
        console.error('Failed to fetch weather:', e);
        setWeather('☁|--°C');
      } finally {
        setLoading(false);
      }
    };

    fetchWeather();
    const interval = setInterval(fetchWeather, 600000);
    return () => clearInterval(interval);
  }, []);

  return { weather, loading };
}