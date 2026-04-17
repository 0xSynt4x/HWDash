import React, { useState, useEffect, useMemo } from 'react';
import { SettingsMenu, Theme, Layout } from './components/SettingsMenu';
import { useAida64 } from './hooks/useAida64';
import { useWeather } from './hooks/useWeather';
import { DynamicLineGraph } from './components/UIComponents';
import { CpuWidget, GpuWidget, RamWidget, NetworkWidget } from './components/Widgets';

export default function App() {
  const { aida, time, status, getStr, getNum } = useAida64();
  const { weather } = useWeather();

  // 网卡选择状态
  const [nicIndex, setNicIndex] = useState(() => parseInt(localStorage.getItem('nicIndex') || '', 10));
  const [showNicMenu, setShowNicMenu] = useState(false);
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });

  // 硬件名称状态
  const [cpuName, setCpuName] = useState(() => localStorage.getItem('cpuName') || "AMD RYZEN 7 9800X3D");
  const [gpuName, setGpuName] = useState(() => localStorage.getItem('gpuName') || "INNO3D RTX 5070 TI");
  const [networkName, setNetworkName] = useState(() => localStorage.getItem('networkName') || "NETWORK");

  // 设置菜单状态
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('theme') as Theme) || 'dark');
  const [layout, setLayout] = useState<Layout>(() => (localStorage.getItem('layout') as Layout) || 'vertical');
  
  // 缩放状态
  const [zoom, setZoom] = useState(() => parseFloat(localStorage.getItem('widgetZoom') || '1'));

  const [showSettings, setShowSettings] = useState(false);
  const [settingsPos, setSettingsPos] = useState({ x: 0, y: 0 });

  // 持久化保存
  useEffect(() => { localStorage.setItem('nicIndex', nicIndex.toString()); }, [nicIndex]);
  useEffect(() => { localStorage.setItem('cpuName', cpuName); }, [cpuName]);
  useEffect(() => { localStorage.setItem('gpuName', gpuName); }, [gpuName]);
  useEffect(() => { localStorage.setItem('networkName', networkName); }, [networkName]);
  useEffect(() => { localStorage.setItem('theme', theme); }, [theme]);
  useEffect(() => { localStorage.setItem('layout', layout); }, [layout]);
  useEffect(() => { localStorage.setItem('widgetZoom', zoom.toString()); }, [zoom]);

  // 动态获取可用的网卡编号
  const availableNics = useMemo(() => {
    const nics = new Set<number>();
    Object.keys(aida).forEach(key => {
      const match = key.match(/^(?:Value\.)?SNIC(\d+)/);
      if (match) nics.add(parseInt(match[1], 10));
    });
    return Array.from(nics).sort((a, b) => a - b);
  }, [aida]);

  const handleNetworkRightClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation(); // 阻止冒泡，避免触发全局设置菜单
    if (availableNics.length > 0) {
      setMenuPos({ x: e.clientX, y: e.clientY });
      setShowNicMenu(true);
    }
  };

  const handleGlobalContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setSettingsPos({ x: e.clientX, y: e.clientY });
    setShowSettings(true);
  };

  useEffect(() => {
    const closeMenu = () => {
      setShowNicMenu(false);
      setShowSettings(false);
    };
    window.addEventListener('click', closeMenu);
    return () => window.removeEventListener('click', closeMenu);
  }, []);

  const formatTime = (date: Date) => `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  const formatDate = (date: Date) => `${date.getFullYear()}/${(date.getMonth() + 1).toString().padStart(2, '0')} ${date.getDate().toString().padStart(2, '0')}`;

  // 处理滚轮缩放事件
  const handleWheel = (e: React.WheelEvent) => {
    if (showSettings) return; // 打开设置时不允许缩放
    
    const step = 0.05;
    const newZoom = Math.min(3.0, Math.max(0.3, zoom + (e.deltaY < 0 ? step : -step)));
    setZoom(Number(newZoom.toFixed(2)));
  };

  const isVertical = layout === 'vertical';
  
  // Tauri OS Window Auto-Resizing
  useEffect(() => {
    if ('__TAURI_INTERNALS__' in window) {
      import('@tauri-apps/api/window').then(({ getCurrentWindow, LogicalSize }) => {
        const w = isVertical ? 280 : 860;
        const h = isVertical ? 960 : 480;
        const currentWindow = getCurrentWindow();
        currentWindow.setSize(new LogicalSize(w * zoom, h * zoom));
      }).catch(console.error);
    }
  }, [layout, zoom, isVertical]);

  return (
    <div 
      className="w-screen h-screen flex justify-center items-center overflow-hidden bg-transparent"
      onWheel={handleWheel}
    >
      <div
        onContextMenu={handleGlobalContextMenu}
        className={`relative bg-[var(--bg-main)] text-[var(--text-primary)] font-mono flex shadow-2xl transition-transform duration-75 ease-out overflow-hidden
        ${theme === 'light' ? 'theme-light' : ''} ${theme === 'tesla' ? 'theme-tesla' : ''} ${theme === 'ferrari' ? 'theme-ferrari' : ''}`}
        style={{
          transform: `scale(${zoom})`,
          transformOrigin: 'center center',
          width: isVertical ? '280px' : '860px',
          height: isVertical ? '960px' : '480px',
          padding: '16px',
          backgroundImage: 'radial-gradient(circle at 20% 30%, var(--bg-gradient-1) 0%, transparent 40%), radial-gradient(circle at 80% 70%, var(--bg-gradient-2) 0%, transparent 40%)'
        }}
      >
        <div style={{ WebkitAppRegion: 'drag' } as any} className="absolute top-0 left-0 w-full h-8 z-50 cursor-move" title="Scroll to Zoom"></div>
        
        {/* State Indicator */}
        <div
          className="absolute top-4 right-4 w-2 h-2 rounded-full z-50 shadow-[0_0_8px_currentColor] transition-colors"
          style={{
            color: status === 'Connected to AIDA64' ? '#00ff00' : '#ff0055',
            backgroundColor: 'currentColor'
          }}
          title={status}
        />

        {isVertical ? (
          // ==============================
          // VERTICAL LAYOUT DESIGN
          // ==============================
          <div className="flex flex-col gap-3 w-full h-full pt-4">
            <div className="flex flex-row items-center justify-between pb-3 border-b border-[var(--border-color)]/50 mt-2 px-2">
              <div className="flex flex-col items-start leading-none gap-1">
                <span className="text-3xl text-[var(--accent)] font-semibold">{weather.split('|')[0]}</span>
                <span className="text-sm font-light text-[var(--text-secondary)]">{weather.split('|')[1]}</span>
              </div>
              <div className="flex flex-col items-end">
                <div className="text-5xl tracking-tighter leading-none" style={{ fontFamily: "'Digital-7 Mono', monospace", color: 'var(--text-primary)' }}>
                  {formatTime(time)}
                </div>
                <div className="text-xs text-[var(--text-secondary)] uppercase mt-1">
                  {formatDate(time)}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 w-full">
              <CpuWidget cpuName={cpuName} setCpuName={setCpuName} getNum={getNum} getStr={getStr} />
              <GpuWidget gpuName={gpuName} setGpuName={setGpuName} getNum={getNum} getStr={getStr} />
              <RamWidget getNum={getNum} getStr={getStr} />
              <NetworkWidget networkName={networkName} setNetworkName={setNetworkName} nicIndex={nicIndex} getStr={getStr} getNum={getNum} onContextMenu={handleNetworkRightClick} />
            </div>

            <div className="flex-1 mt-auto border border-[var(--border-color)] rounded-md bg-[rgba(255,255,255,0.02)] flex flex-col p-2 min-h-[140px]">
              <div className="flex justify-between items-center text-xs font-bold px-1 mb-1 border-b border-[var(--border-color)]/50 pb-1">
                <span className="text-[var(--text-secondary)]">UPTIME</span>
                <span className="text-[var(--accent)]">{getStr('SUPTIME', '00:00:00')}</span>
              </div>
              <div className="flex justify-between text-[10px] my-1 px-1 opacity-80">
                <span className="text-[#ff00ff]">CPU: {getStr('PCPUPKG')} W</span>
                <span className="text-[#00d4ff]">GPU: {getStr('PGPU1')} W</span>
                <span className="text-[#ffff00]">FPS: {getStr('SRTSSFPS')}</span>
              </div>
              <div className="flex-1 relative w-full h-full mt-1">
                <DynamicLineGraph cpuPower={getNum('PCPUPKG')} gpuPower={getNum('PGPU1')} fps={getNum('SRTSSFPS')} />
              </div>
            </div>
          </div>
        ) : (
          // ==============================
          // HORIZONTAL LAYOUT DESIGN
          // ==============================
          <div className="grid grid-cols-[250px_1fr] gap-4 w-full pt-4">
            
            {/* Left Column: Metrics overview */}
            <div className="flex flex-col gap-3 h-full">
              <div className="flex flex-row items-center justify-between pb-3 border-b border-[var(--border-color)]/40 px-1 mt-1">
                <div className="flex flex-col items-start leading-none gap-1">
                  <span className="text-3xl text-[var(--accent)] font-semibold">{weather.split('|')[0]}</span>
                  <span className="text-sm font-light text-[var(--text-secondary)]">{weather.split('|')[1]}</span>
                </div>
                <div className="flex flex-col items-end pt-1">
                  <div className="text-5xl tracking-tighter leading-none" style={{ fontFamily: "'Digital-7 Mono', monospace", color: 'var(--text-primary)' }}>
                    {formatTime(time)}
                  </div>
                  <div className="text-[10px] text-[var(--text-secondary)] uppercase mt-1">
                    {formatDate(time)}
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3 flex-1 mt-1">
                <RamWidget getNum={getNum} getStr={getStr} />
                <NetworkWidget networkName={networkName} setNetworkName={setNetworkName} nicIndex={nicIndex} getStr={getStr} getNum={getNum} onContextMenu={handleNetworkRightClick} />
              </div>
            </div>

            {/* Right Column: Hardware Details & Uptime */}
            <div className="flex flex-col gap-4 h-full">
              <div className="grid grid-cols-2 gap-3 pb-1">
                <CpuWidget cpuName={cpuName} setCpuName={setCpuName} getNum={getNum} getStr={getStr} />
                <GpuWidget gpuName={gpuName} setGpuName={setGpuName} getNum={getNum} getStr={getStr} />
              </div>
              
              <div className="flex-1 mt-auto border border-[var(--border-color)] min-h-[140px] rounded-md bg-[rgba(255,255,255,0.02)] flex flex-col p-2">
                <div className="flex justify-between items-center text-xs font-bold px-1 mb-1 border-b border-[var(--border-color)]/50 pb-1">
                  <span className="text-[var(--text-secondary)]">UPTIME</span>
                  <span className="text-[var(--accent)]">{getStr('SUPTIME', '00:00:00')}</span>
                </div>
                <div className="flex justify-around text-[10px] my-1 px-1 opacity-80">
                  <span className="text-[#ff00ff]">CPU: {getStr('PCPUPKG')} W</span>
                  <span className="text-[#00d4ff]">GPU: {getStr('PGPU1')} W</span>
                  <span className="text-[#ffff00]">FPS: {getStr('SRTSSFPS')}</span>
                </div>
                <div className="flex-1 relative w-full mt-1">
                  <DynamicLineGraph cpuPower={getNum('PCPUPKG')} gpuPower={getNum('PGPU1')} fps={getNum('SRTSSFPS')} />
                </div>
              </div>
            </div>
            
          </div>
        )}

      </div>

      {/* 设置右键菜单 */}
      {showSettings && (
        <SettingsMenu
          x={settingsPos.x}
          y={settingsPos.y}
          onClose={() => setShowSettings(false)}
          theme={theme}
          setTheme={setTheme}
          layout={layout}
          setLayout={setLayout}
        />
      )}

      {/* 网卡选择右键菜单 */}
      {showNicMenu && (
        <div
          className="fixed z-[100] bg-[var(--bg-panel)] border border-[var(--accent)] rounded shadow-lg py-1 font-mono text-[10px] backdrop-blur-md"
          style={{ top: menuPos.y, left: menuPos.x }}
          onClick={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.stopPropagation()}
        >
          <div className="px-2 py-1 text-[var(--text-secondary)] border-b border-[var(--border-color)] mb-1">Select Network Adapter</div>
          {availableNics.length > 0 ? availableNics.map(nic => (
            <div
              key={nic}
              className={`px-4 py-1 cursor-pointer hover:bg-[var(--accent)] hover:bg-opacity-20 ${nicIndex === nic ? 'text-[var(--accent)]' : 'text-[var(--text-primary)]'}`}
              onClick={() => { setNicIndex(nic); setShowNicMenu(false); }}
            >
              NIC {nic}
            </div>
          )) : (
            <div className="px-4 py-1 text-[var(--text-primary)]">No NICs found</div>
          )}
        </div>
      )}
    </div>
  );
}
