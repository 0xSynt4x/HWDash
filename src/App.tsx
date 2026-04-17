import React, { useState, useEffect, useMemo } from 'react';
import { SettingsMenu, Theme, Layout } from './components/SettingsMenu';
import { useAida64 } from './hooks/useAida64';
import { useWeather } from './hooks/useWeather';
import { Panel, PanelHeader, DynamicLineGraph } from './components/UIComponents';
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
  const [showSettings, setShowSettings] = useState(false);
  const [settingsPos, setSettingsPos] = useState({ x: 0, y: 0 });

  // 持久化保存
  useEffect(() => { localStorage.setItem('nicIndex', nicIndex.toString()); }, [nicIndex]);
  useEffect(() => { localStorage.setItem('cpuName', cpuName); }, [cpuName]);
  useEffect(() => { localStorage.setItem('gpuName', gpuName); }, [gpuName]);
  useEffect(() => { localStorage.setItem('networkName', networkName); }, [networkName]);
  useEffect(() => { localStorage.setItem('theme', theme); }, [theme]);
  useEffect(() => { localStorage.setItem('layout', layout); }, [layout]);

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

  return (
    <div
      onContextMenu={handleGlobalContextMenu}
      className={`relative overflow-hidden bg-[var(--bg-main)] text-[var(--text-primary)] font-mono flex ${layout === 'horizontal' ? 'flex-row flex-wrap gap-2 items-stretch' : 'flex-col'} rounded-lg border border-[var(--border-color)] shadow-2xl ${theme === 'light' ? 'theme-light' : ''} ${theme === 'tesla' ? 'theme-tesla' : ''} ${theme === 'ferrari' ? 'theme-ferrari' : ''}`}
      style={{
        width: '100%',
        minHeight: '100vh',
        minWidth: layout === 'horizontal' ? '760px' : '260px',
        padding: '8px',
        backgroundImage: 'radial-gradient(circle at 20% 30%, var(--bg-gradient-1) 0%, transparent 40%), radial-gradient(circle at 80% 70%, var(--bg-gradient-2) 0%, transparent 40%)'
      }}
    >
      <div style={{ WebkitAppRegion: 'drag' } as any} className="absolute top-0 left-0 w-full h-8 z-50 cursor-move"></div>
      {/* Time Section */}
      <div className={`flex flex-row items-center justify-center mb-2 mt-2 gap-4 ${layout === 'horizontal' ? 'w-full' : ''}`}>
        <div className="flex flex-col items-center">
          <span className="text-2xl">{weather.split('|')[0]}</span>
          <span className="text-lg font-light text-[var(--text-primary)]">{weather.split('|')[1]}</span>
        </div>
        <div className="flex flex-col items-center">
          <div className="text-4xl font-light text-[var(--text-primary)] tracking-tighter leading-none" style={{ fontFamily: "'Digital-7 Mono', monospace" }}>
            {formatTime(time)}
          </div>
          <div className="text-xs text-[var(--text-secondary)] uppercase font-mono">
            {formatDate(time)}
          </div>
        </div>
      </div>

      <div className={`flex flex-col gap-2 ${layout === 'horizontal' ? 'flex-1' : ''} min-w-[240px]`}>
        <CpuWidget cpuName={cpuName} setCpuName={setCpuName} getNum={getNum} getStr={getStr} />
        <GpuWidget gpuName={gpuName} setGpuName={setGpuName} getNum={getNum} getStr={getStr} />
      </div>

      <div className="flex flex-col gap-2 flex-1 min-w-[240px]">
        <RamWidget getNum={getNum} getStr={getStr} />
        <NetworkWidget networkName={networkName} setNetworkName={setNetworkName} nicIndex={nicIndex} getStr={getStr} onContextMenu={handleNetworkRightClick} />

        {/* Uptime & Graph Section */}
        <Panel className="flex-1 mb-0 flex flex-col min-h-[120px]">
          <PanelHeader title="UPTIME:" rightText={getStr('SUPTIME', '00:00:00')} />
          <div className="flex justify-around px-2 py-1 text-[12px] font-mono">
            <span className="text-[#ff00ff]">{getStr('PCPUPKG')} W</span>
            <span className="text-[#00d4ff]">{getStr('PGPU1')} W</span>
            <span className="text-[#ffff00]">{getStr('SRTSSFPS')} FPS</span>
          </div>
          <div className="flex-1 relative mt-1 border-t border-[var(--border-color)] mx-1 min-h-[60px]">
            <DynamicLineGraph cpuPower={getNum('PCPUPKG')} gpuPower={getNum('PGPU1')} fps={getNum('SRTSSFPS')} />
          </div>
        </Panel>
      </div>

      {/* 状态指示灯 (右上角) */}
      <div
        className="absolute top-3 right-3 w-2 h-2 rounded-full z-50 shadow-[0_0_5px_currentColor]"
        style={{
          color: status === 'Connected to AIDA64' ? '#00ff00' : '#ff0055',
          backgroundColor: 'currentColor'
        }}
        title={status}
      />

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
