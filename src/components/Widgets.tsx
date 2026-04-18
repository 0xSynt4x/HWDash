import { Cpu, HardDrive, MemoryStick, Globe, Zap, Plug, Gauge, Fan, Activity, Download, Upload, Network } from 'lucide-react';
import { Panel, PanelHeader, StatRow, BarGraph } from './UIComponents';
import { getValueColor, getGlowColor } from '../utils/colors';

export const CpuWidget = ({ cpuName, setCpuName, getNum, getStr }: any) => (
  <Panel className="min-w-[240px] h-full flex flex-col">
    <PanelHeader icon={Cpu} title={cpuName} onTitleChange={setCpuName} />
    <div className="p-1 flex flex-col flex-1">
      <div className="flex justify-between items-start mb-2 px-1">
        <div className="flex items-center gap-2">
          <div className="w-4 h-8 border border-[var(--border-color)] rounded-sm flex flex-col justify-end p-[1px] bg-[rgba(255,255,255,0.05)]">
            <div
              className="w-full transition-all"
              style={{
                height: `${Math.min(100, getNum('TCPU'))}%`,
                backgroundColor: getGlowColor(getNum('TCPU'), 'temp'),
                boxShadow: `0 0 10px ${getGlowColor(getNum('TCPU'), 'temp')}`
              }}
            ></div>
          </div>
          <div className={`text-4xl font-light leading-none font-mono ${getValueColor(getNum('TCPU'), 'temp')}`}>{getStr('TCPU')}</div>
          <div className="flex flex-col text-[12px] leading-none justify-center font-mono">
            <span className="opacity-50">°C</span>
            <span className={getNum('TCPU') >= 85 ? "text-[#ff0055] animate-pulse" : "opacity-0"}>⚠</span>
          </div>
        </div>
        <div className="flex flex-col text-right text-[12px] font-mono leading-tight mt-1 text-[var(--text-secondary)] tracking-tight">
          <div><span className="opacity-50">CHIP:</span> <span className={getValueColor(getNum('TCHIP'), 'temp')}>{getStr('TCHIP', '--')}°C</span></div>
          <div><span className="opacity-50">VRM:</span> <span className={getValueColor(getNum('TVRM'), 'temp')}>{getStr('TVRM', '--')}°C</span></div>
        </div>
      </div>
      <StatRow icon={Zap} label="VOLTAGE:" value={<div>{getStr('VCPU')} <span className="text-[12px] opacity-50">V</span></div>} colorClass={getValueColor(getNum('VCPU'), 'voltage_cpu')} />
      <StatRow icon={Plug} label="POWER:" value={<div>{getStr('PCPUPKG')} <span className="text-[12px] opacity-50">W</span></div>} />
      <StatRow icon={Gauge} label="CLOCK:" value={<div>{getStr('SCPUCLK')} <span className="text-[12px] opacity-50">MHZ</span></div>} />
      <StatRow icon={Activity} label="LOAD:" value={<div>{getStr('SCPUUTI')} <span className="text-[12px] opacity-50">%</span></div>} colorClass={getValueColor(getNum('SCPUUTI'), 'load')} />
      <StatRow icon={Fan} label="FAN:" value={<div className="flex gap-1"><span>{getStr('FCPU')}</span> <span className="opacity-50 text-[12px] leading-relaxed">/</span> <span>{getStr('FCHA1')}</span> <span className="text-[12px] opacity-50">RPM</span></div>} colorClass={getValueColor(getNum('FCPU'), 'fan')} />
      {/* 强行推到底部 */}
      <div className="mt-auto pt-1 w-full">
        <BarGraph load={getNum('SCPUUTI')} />
      </div>
    </div>
  </Panel>
);

export const GpuWidget = ({ gpuName, setGpuName, getNum, getStr }: any) => (
  <Panel className="min-w-[240px] h-full flex flex-col">
    <PanelHeader icon={HardDrive} title={gpuName} onTitleChange={setGpuName} />
    <div className="p-1 flex flex-col flex-1">
      <div className="flex justify-between items-start mb-2 px-1">
        <div className="flex items-center gap-1">
          <div className="w-4 h-8 border border-[var(--border-color)] rounded-sm flex flex-col justify-end p-[1px] bg-[rgba(255,255,255,0.05)]">
            <div
              className="w-full transition-all"
              style={{
                height: `${Math.min(100, getNum('TGPU1'))}%`,
                backgroundColor: getGlowColor(getNum('TGPU1'), 'temp'),
                boxShadow: `0 0 10px ${getGlowColor(getNum('TGPU1'), 'temp')}`
              }}
            ></div>
          </div>
          <div className="flex items-start" title="GPU Core Temp">
            <div className={`text-4xl font-light leading-none font-mono ${getValueColor(getNum('TGPU1'), 'temp')}`}>{getStr('TGPU1')}</div>
            <div className="flex flex-col text-[12px] leading-none justify-center ml-1 font-mono">
              <span className="opacity-50">°C</span>
            </div>
          </div>
          <div className="flex items-start ml-2 relative" title="VRAM Temp">
            <div className="absolute -top-3 left-0 text-[8px] text-[var(--accent)] opacity-60">MEM</div>
            <div className={`text-2xl font-light leading-none font-mono ${getValueColor(getNum('TGPU1MEM'), 'temp')}`}>{getStr('TGPU1MEM')}</div>
            <div className="flex flex-col text-[12px] leading-none justify-center ml-1 font-mono">
              <span className="opacity-50">°C</span>
            </div>
          </div>
        </div>
        <div className="flex flex-col text-right text-[12px] font-mono leading-tight mt-1 text-[var(--text-secondary)] tracking-tight">
          <div><span className="opacity-50">FAN1:</span> <span className={getValueColor(getNum('DGPU1'), 'fan_percent')}>{getStr('DGPU1', '0')}%</span></div>
          <div><span className="opacity-50">FAN2:</span> <span className={getValueColor(getNum('DGPU1GPU2'), 'fan_percent')}>{getStr('DGPU1GPU2', '0')}%</span></div>
        </div>
      </div>
       
      <StatRow icon={Zap} label="VOLTAGE:" value={<div>{getStr('VGPU1')} <span className="text-[12px] opacity-50">V</span></div>} colorClass={getValueColor(getNum('VGPU1'), 'voltage_gpu')} />
      <StatRow icon={Plug} label="POWER:" value={<div className="flex gap-1 items-baseline"><span>{getStr('PGPU1')}</span> <span className="text-[12px] opacity-50">W</span> <span className="opacity-50 font-normal">[{getStr('PGPU1TDPP')}%]</span></div>} />
      <StatRow icon={Gauge} label="CLOCK:" value={<div className="flex gap-1"><span>{getStr('SGPU1CLK')}</span> <span className="opacity-50 text-[12px] leading-relaxed">/</span> <span>{getStr('SGPU1MEMCLK')}</span> <span className="text-[12px] opacity-50">MHZ</span></div>} />
      <StatRow icon={Activity} label="VRAM:" value={<div>{getStr('SUSEDVMEM')} <span className="text-[12px] opacity-50">MB</span></div>} colorClass={getValueColor((getNum('SUSEDVMEM') / 16384) * 100, 'ram')} />
      {/* 强行推到底部，从而弥补 GPU 缺少的一行数据空间，保持图表对齐 */}
      <div className="mt-auto pt-1 w-full">
        <BarGraph load={getNum('SGPU1UTI')} />
      </div>
    </div>
  </Panel>
);

export const RamWidget = ({ getNum, getStr }: any) => {
  const memUsed = getNum('SUSEDMEM');
  const memFree = getNum('SFREEMEM');
  const memTotal = memUsed + memFree || 1;
  const usagePercent = (memUsed / memTotal) * 100;
  
  return (
    <Panel className="min-w-[240px] relative overflow-hidden flex-shrink-0">
      {/* 背景进度条 */}
      <div 
        className="absolute top-0 left-0 h-full transition-all duration-700 ease-out z-0"
        style={{
          width: `${usagePercent}%`,
          background: 'linear-gradient(90deg, rgba(15, 43, 51, 0.6) 0%, rgba(17, 66, 73, 0.4) 100%)',
        }}
      />
      
      {/* 
        前景色：
        - min-h-[36px] 保证有个合理的基础高度
        - h-full w-full 配合 items-center 做到绝对的垂直居中，再也不会偏下
        - 稍微缩小 padding (py-1.5) 防止内部过高被裁切
      */}
      <div className="relative z-10 flex items-center justify-between font-mono text-[14px] uppercase tracking-[2px] text-[var(--accent)] px-2 py-1.5 w-full h-full min-h-[36px]">
        <div className="flex items-center gap-2 flex-1">
          <MemoryStick size={14} strokeWidth={2} className="opacity-80" />
          {/* leading-none 避免默认行高导致视觉偏下 */}
          <span className="font-semibold leading-none mt-0.5">MEMORY</span>
        </div>
        <div className="ml-2 text-[12px] flex items-center gap-1">
          <span className="font-mono text-[var(--accent)] leading-none mt-0.5">{getStr('SUSEDMEM')}</span>
          <span className="opacity-50 text-[10px] leading-none mt-0.5">/ {memTotal}</span>
        </div>
      </div>
    </Panel>
  );
};
export const NetworkWidget = ({ networkName, setNetworkName, nicIndex, getStr, getNum, onContextMenu }: any) => {
  const dnRate = getNum(`SNIC${nicIndex}DLRATE`);
  const ulRate = getNum(`SNIC${nicIndex}ULRATE`);
  const isDownloading = dnRate > 0.1;
  const isUploading = ulRate > 0.1;
  
  return (
    <Panel className="min-w-[240px]">
      <div onContextMenu={onContextMenu} className="cursor-context-menu" title="Right click to change Network Adapter">
        <PanelHeader icon={Globe} title={networkName} onTitleChange={setNetworkName} rightText={<div className="flex items-baseline gap-1"><span className="font-mono text-sm">{getStr(`SNIC${nicIndex}TOTDL`, '0')}</span><span className="text-[12px] opacity-50">MB</span></div>} />
        <div className="p-1 space-y-1">
          <div className="flex items-center gap-2">
            <div className={`flex-1 flex items-center gap-1.5 p-1 rounded border ${isDownloading ? 'bg-[var(--bg-gradient-1)]/50 border-[var(--accent)]/30' : 'border-[var(--border-color)]/50'}`}>
              <Download size={12} className={isDownloading ? 'text-[var(--accent)] animate-bounce' : 'text-[var(--text-muted)]'} />
              <span className="font-mono text-xs">{getStr(`SNIC${nicIndex}DLRATE`, '0')}</span>
              <span className="text-[8px] text-[var(--text-muted)]">↓</span>
            </div>
            <div className={`flex-1 flex items-center gap-1.5 p-1 rounded border ${isUploading ? 'bg-[var(--bg-gradient-2)]/50 border-[var(--accent-secondary)]/30' : 'border-[var(--border-color)]/50'}`}>
              <Upload size={12} className={isUploading ? 'text-[var(--accent-secondary)]' : 'text-[var(--text-muted)]'} />
              <span className="font-mono text-xs">{getStr(`SNIC${nicIndex}ULRATE`, '0')}</span>
              <span className="text-[8px] text-[var(--text-muted)]">↑</span>
            </div>
          </div>

          <div className="flex items-center justify-between p-1 rounded bg-[var(--bg-main)]/50 border border-[var(--border-color)]/50">
            <div className="flex items-center gap-1">
              <Network size={10} className="text-[var(--text-muted)]" />
              <span className="text-[12px] uppercase tracking-wider text-[var(--text-secondary)]">IP</span>
            </div>
            <span className="font-mono text-[12px]">{getStr('SPRIIPADDR', '127.0.0.1')}</span>
          </div>
        </div>
      </div>
    </Panel>
  );
};