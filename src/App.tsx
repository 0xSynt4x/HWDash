import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { getCurrentWindow, LogicalSize } from '@tauri-apps/api/window';
import { Calendar } from 'lucide-react';
import { SettingsMenu } from './components/SettingsMenu';
import { useAida64 } from './hooks/useAida64';
import { useWeather } from './hooks/useWeather';
import { useSettings } from './hooks/useSettings';
import { DynamicLineGraph } from './components/UIComponents';
import { CpuWidget, GpuWidget, RamWidget, NetworkWidget } from './components/Widgets';

const isTauri = (): boolean => '__TAURI_INTERNALS__' in window;

const BASE_SIZES = {
  vertical: { w: 280, h: 960 },
  horizontal: { w: 860, h: 480 },
} as const;

export default function App() {
  const { settings, loaded, update } = useSettings();
  const { time, status, getStr, getNum, aida } = useAida64();
  const { weather } = useWeather(settings.latitude, settings.longitude);

  const [showNicMenu, setShowNicMenu] = useState(false);
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });
  const [showSettings, setShowSettings] = useState(false);
  const [settingsPos, setSettingsPos] = useState({ x: 0, y: 0 });

  // 动态获取可用的网卡编号
  const availableNics = useMemo(() => {
    const nics = new Set<number>();
    Object.keys(aida).forEach((key) => {
      const match = key.match(/^(?:Value\.)?SNIC(\d+)/);
      if (match) nics.add(parseInt(match[1], 10));
    });
    return Array.from(nics).sort((a, b) => a - b);
  }, [aida]);

  // 自动选择第一个可用 NIC(若当前未选或失效)
  useEffect(() => {
    if (!loaded) return;
    const current = settings.nic_index;
    if ((current < 0 || !availableNics.includes(current)) && availableNics.length > 0) {
      update('nic_index', availableNics[0]);
    }
  }, [availableNics, loaded, settings.nic_index, update]);

  const handleNetworkRightClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setMenuPos({ x: e.clientX, y: e.clientY });
    setShowNicMenu(true);
  }, []);

  const handleGlobalContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setSettingsPos({ x: e.clientX, y: e.clientY });
    setShowSettings(true);
  }, []);

  useEffect(() => {
    const closeMenu = () => {
      setShowNicMenu(false);
      setShowSettings(false);
    };
    window.addEventListener('click', closeMenu);
    return () => window.removeEventListener('click', closeMenu);
  }, []);

  const formatTime = (date: Date) =>
    `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  const formatDate = (date: Date) =>
    `${date.getFullYear()}/${(date.getMonth() + 1).toString().padStart(2, '0')} ${date
      .getDate()
      .toString()
      .padStart(2, '0')}`;

  // 滚轮缩放
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (showSettings) return;
      const step = 0.05;
      const newZoom = Math.min(
        3.0,
        Math.max(0.3, settings.zoom + (e.deltaY < 0 ? step : -step))
      );
      update('zoom', Number(newZoom.toFixed(2)));
    },
    [settings.zoom, showSettings, update]
  );

  const isVertical = settings.layout === 'vertical';
  const baseW = isVertical ? BASE_SIZES.vertical.w : BASE_SIZES.horizontal.w;
  const baseH = isVertical ? BASE_SIZES.vertical.h : BASE_SIZES.horizontal.h;
  const zoom = settings.zoom;
  const scaledW = baseW * zoom;
  const scaledH = baseH * zoom;

  // 把主题 class 应用到 <html> 上,使 fixed 定位的弹层(SettingsMenu / NIC 菜单)也能继承主题变量
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('theme-light', 'theme-tesla', 'theme-ferrari');
    if (settings.theme !== 'dark') {
      root.classList.add(`theme-${settings.theme}`);
    }
  }, [settings.theme]);

  // Tauri 窗口尺寸跟随缩放后的视觉尺寸:
  // 等设置加载完成后再调用,避免首屏把"默认尺寸"先施加一遍造成闪烁
  useEffect(() => {
    if (!isTauri() || !loaded) return;
    getCurrentWindow()
      .setSize(new LogicalSize(scaledW, scaledH))
      .catch(() => {
        /* 忽略 */
      });
  }, [scaledW, scaledH, loaded]);

  return (
    <div
      className="w-screen h-screen overflow-hidden bg-transparent"
      onWheel={handleWheel}
    >
      {/* 外层占据缩放后的实际像素,使窗口刚好包住内容,无空白边框 */}
      <div style={{ width: `${scaledW}px`, height: `${scaledH}px` }}>
        <div
          onContextMenu={handleGlobalContextMenu}
          className="relative bg-[var(--bg-main)] text-[var(--text-primary)] font-mono flex shadow-2xl overflow-hidden"
          style={{
            width: `${baseW}px`,
            height: `${baseH}px`,
            transform: `scale(${zoom})`,
            transformOrigin: 'top left',
            padding: '16px',
            backgroundImage:
              'radial-gradient(circle at 20% 30%, var(--bg-gradient-1) 0%, transparent 40%), radial-gradient(circle at 80% 70%, var(--bg-gradient-2) 0%, transparent 40%)',
          }}
        >
          {/* Tauri v2 拖动区域:左键按下顶部 32px 区域开始拖动窗口 */}
          <div
            data-tauri-drag-region
            onMouseDown={(e) => {
              // 只响应左键,且必须是该区域本体(避免遮挡内部交互)
              if (e.button !== 0) return;
              if (e.target !== e.currentTarget) return;
              if (!isTauri()) return;
              // 显式调用 startDragging,作为 data-tauri-drag-region 的双保险
              getCurrentWindow().startDragging().catch((err) => {
                console.error('startDragging failed:', err);
              });
            }}
            className="absolute top-0 left-0 w-full h-8 z-50 cursor-move select-none"
          />

          {/* 状态指示灯 */}
          <div
            className="absolute top-4 right-4 w-2 h-2 rounded-full z-50 shadow-[0_0_8px_currentColor] transition-colors"
            style={{
              color: status === 'Connected to AIDA64' ? '#00ff00' : '#ff0055',
              backgroundColor: 'currentColor',
            }}
            title={status}
          />

          {isVertical ? (
            // ============ 纵向布局 ============
            <div className="flex flex-col gap-2 w-full h-full pt-2">
              <div className="flex flex-row items-center justify-between pb-2 border-b border-[var(--border-color)]/50 mt-1 px-1">
                <div className="flex items-center gap-3">
                  <div className="flex flex-col items-start leading-none gap-1">
                    <span className="text-4xl text-[var(--accent)] font-semibold">
                      {weather.split('|')[0]}
                    </span>
                    <span className="text-lg font-light text-[var(--text-secondary)]">
                      {weather.split('|')[1]}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col items-end">
                  <div className="font-digital text-4xl tracking-widest leading-none font-bold text-[var(--text-primary)]">
                    {formatTime(time)}
                  </div>
                  <div className="flex items-center gap-1 text-base text-[var(--text-secondary)] uppercase mt-1">
                    <Calendar size={12} />
                    {formatDate(time)}
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2 w-full">
                <CpuWidget
                  cpuName={settings.cpu_name}
                  setCpuName={(v) => update('cpu_name', v)}
                  getNum={getNum}
                  getStr={getStr}
                />
                <GpuWidget
                  gpuName={settings.gpu_name}
                  setGpuName={(v) => update('gpu_name', v)}
                  getNum={getNum}
                  getStr={getStr}
                />
                <RamWidget getNum={getNum} getStr={getStr} />
                <NetworkWidget
                  networkName={settings.network_name}
                  setNetworkName={(v) => update('network_name', v)}
                  nicIndex={settings.nic_index}
                  getStr={getStr}
                  getNum={getNum}
                  onContextMenu={handleNetworkRightClick}
                />
              </div>

              <div className="flex-1 mt-auto border border-[var(--border-color)] rounded-md bg-[rgba(255,255,255,0.02)] flex flex-col p-2 min-h-[180px]">
                <div className="flex justify-between items-center text-sm font-bold px-1 mb-1 border-b border-[var(--border-color)]/50 pb-1">
                  <span className="text-[var(--text-secondary)]">UPTIME</span>
                  <span className="font-digital text-[var(--accent)] tracking-wider">{getStr('SUPTIME', '00:00:00')}</span>
                </div>
                <div className="flex justify-between text-[13px] my-1 px-1 opacity-80">
                  <span className="text-[var(--chart-cpu)]">CPU:&nbsp;<span className="font-digital">{getStr('PCPUPKG')}</span>&nbsp;W</span>
                  <span className="text-[var(--chart-gpu)]">GPU:&nbsp;<span className="font-digital">{getStr('PGPU1')}</span>&nbsp;W</span>
                  <span className="text-[var(--chart-fps)]">FPS:&nbsp;<span className="font-digital">{getStr('SRTSSFPS')}</span></span>
                </div>
                <div className="flex-1 relative w-full h-full mt-1">
                  <DynamicLineGraph
                    cpuPower={getNum('PCPUPKG')}
                    gpuPower={getNum('PGPU1')}
                    fps={getNum('SRTSSFPS')}
                  />
                </div>
              </div>
            </div>
          ) : (
            // ============ 横向布局 ============
            <div className="flex flex-col gap-3 w-full h-full pt-2 pb-1">
              <div className="grid grid-cols-[250px_1fr] gap-4 min-h-0 flex-none">
                <div className="flex flex-col justify-between h-full pb-0">
                  <div className="flex flex-row items-center justify-between pb-2 border-b border-[var(--border-color)]/40 px-1 mt-1">
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col items-start leading-none gap-1">
                        <span className="text-4xl text-[var(--accent)] font-semibold">
                          {weather.split('|')[0]}
                        </span>
                        <span className="text-lg font-light text-[var(--text-secondary)]">
                          {weather.split('|')[1]}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end">
                      <div className="font-digital text-4xl tracking-widest leading-none font-bold text-[var(--text-primary)]">
                        {formatTime(time)}
                      </div>
                      <div className="flex items-center gap-1 text-base text-[var(--text-secondary)] uppercase mt-1">
                        <Calendar size={12} />
                        {formatDate(time)}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 w-full mt-auto pt-2">
                    <RamWidget getNum={getNum} getStr={getStr} />
                    <NetworkWidget
                      networkName={settings.network_name}
                      setNetworkName={(v) => update('network_name', v)}
                      nicIndex={settings.nic_index}
                      getStr={getStr}
                      getNum={getNum}
                      onContextMenu={handleNetworkRightClick}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 h-full">
                  <CpuWidget
                    cpuName={settings.cpu_name}
                    setCpuName={(v) => update('cpu_name', v)}
                    getNum={getNum}
                    getStr={getStr}
                  />
                  <GpuWidget
                    gpuName={settings.gpu_name}
                    setGpuName={(v) => update('gpu_name', v)}
                    getNum={getNum}
                    getStr={getStr}
                  />
                </div>
              </div>

              <div className="flex-1 border border-[var(--border-color)] rounded-md bg-[rgba(255,255,255,0.02)] flex flex-col p-2 w-full">
                <div className="flex justify-between items-center text-sm font-bold px-1 mb-1 border-b border-[var(--border-color)]/50 pb-1">
                  <span className="text-[var(--text-secondary)]">UPTIME</span>
                  <span className="font-digital text-[var(--accent)] tracking-wider">{getStr('SUPTIME', '00:00:00')}</span>
                </div>
                <div className="flex justify-around text-[13px] my-1 px-1 opacity-80">
                  <span className="text-[var(--chart-cpu)]">CPU:&nbsp;<span className="font-digital">{getStr('PCPUPKG')}</span>&nbsp;W</span>
                  <span className="text-[var(--chart-gpu)]">GPU:&nbsp;<span className="font-digital">{getStr('PGPU1')}</span>&nbsp;W</span>
                  <span className="text-[var(--chart-fps)]">FPS:&nbsp;<span className="font-digital">{getStr('SRTSSFPS')}</span></span>
                </div>
                <div className="flex-1 relative w-full h-full mt-1">
                  <DynamicLineGraph
                    cpuPower={getNum('PCPUPKG')}
                    gpuPower={getNum('PGPU1')}
                    fps={getNum('SRTSSFPS')}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 设置右键菜单 */}
      {showSettings && (
        <SettingsMenu
          x={settingsPos.x}
          y={settingsPos.y}
          onClose={() => setShowSettings(false)}
          settings={settings}
          update={update}
        />
      )}

      {/* 网卡选择右键菜单 */}
      {showNicMenu && (
        <div
          className="fixed z-[100] bg-[var(--bg-panel)] border border-[var(--accent)] rounded shadow-lg py-1 font-mono text-[13px] backdrop-blur-md"
          style={{ top: menuPos.y, left: menuPos.x }}
          onClick={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.stopPropagation()}
        >
          <div className="px-2 py-1 text-[var(--text-secondary)] border-b border-[var(--border-color)] mb-1">
            Select Network Adapter
          </div>
          {availableNics.length > 0 ? (
            availableNics.map((nic) => (
              <div
                key={nic}
                className={`px-4 py-1 cursor-pointer hover:bg-[var(--accent)] hover:bg-opacity-20 ${
                  settings.nic_index === nic
                    ? 'text-[var(--accent)]'
                    : 'text-[var(--text-primary)]'
                }`}
                onClick={() => {
                  update('nic_index', nic);
                  setShowNicMenu(false);
                }}
              >
                NIC {nic}
              </div>
            ))
          ) : (
            <div className="px-4 py-1 text-[var(--text-primary)]">No NICs found</div>
          )}
        </div>
      )}
    </div>
  );
}
