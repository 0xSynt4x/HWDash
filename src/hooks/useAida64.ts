import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core'; // 引入 Tauri 的 invoke 方法

export function useAida64() {
  const [aida, setAida] = useState<Record<string, string>>({});
  const [time, setTime] = useState(new Date());
  const [status, setStatus] = useState('Waiting for AIDA64...');

  useEffect(() => {
    const timeInterval = setInterval(() => setTime(new Date()), 1000);

    const hwInterval = setInterval(async () => {
      try {
        // 使用 Tauri 的 invoke 调用 Rust 后端的 get_hardware_data 函数
        const rawData = await invoke<Record<string, string>>('get_hardware_data');
        if (rawData && Object.keys(rawData).length > 0) {
          setAida(rawData);
          setStatus('Connected to AIDA64');
        } else {
          setStatus('Registry empty. Is AIDA64 writing to it?');
        }
      } catch (e: any) {
        // 捕获 Rust 后端返回的错误
        setStatus(`Error: ${e}`);
      }
    }, 1000);

    return () => {
      clearInterval(timeInterval);
      clearInterval(hwInterval);
    };
  }, []);

  const getStr = (key: string, fallback = '0') => aida[`Value.${key}`] ?? aida[key] ?? fallback;
  const getNum = (key: string) => parseFloat(aida[`Value.${key}`] ?? aida[key]) || 0;

  return { aida, time, status, getStr, getNum };
}
