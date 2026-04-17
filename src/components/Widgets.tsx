import { Cpu, HardDrive, MemoryStick, Globe, Zap, Plug, Gauge, Fan, Activity, Download, Upload, Network } from 'lucide-react';
import { Panel, PanelHeader, StatRow, BarGraph } from './UIComponents';
import { getValueColor, getGlowColor } from '../utils/colors';

export const CpuWidget = ({ cpuName, setCpuName, getNum, getStr }: any) => (
  <Panel className="min-w-[240px]">
    <PanelHeader icon={Cpu} title={cpuName} onTitleChange={setCpuName} />
    <div className="p-1">
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
          <div className="flex flex-col text-[10px] leading-none justify-center font-mono">
            <span className="opacity-50">°C</span>
            <span className={getNum('TCPU') >= 85 ? "text-[#ff0055] animate-pulse" : "text-[var(--text-secondary)] opacity-0"}>TOO</span>
            <span className={getNum('TCPU') >= 85 ? "text-[#ff0055] animate-pulse" : "text-[var(--text-secondary)] opacity-0"}>HOT</span>
          </div>
        </div>
        <div className="flex flex-col text-right text-[12px] font-mono leading-tight mt-1 text-[var(--text-secondary)] tracking-tight">
          <div><span className="opacity-50">CHIP:</span> <span className={getValueColor(getNum('TCHIP'), 'temp')}>{getStr('TCHIP', '--')}°C</span></div>
          <div><span className="opacity-50">VRM:</span> <span className={getValueColor(getNum('TVRM'), 'temp')}>{getStr('TVRM', '--')}°C</span></div>
        </div>
      </div>
      <div className="mb-[2px]">
        <StatRow icon={Zap} label="VOLTAGE:" value={<div>{getStr('VCPU')} <span className="text-[9px] opacity-50">V</span></div>} colorClass={getValueColor(getNum('VCPU'), 'voltage_cpu')} />
        <StatRow icon={Plug} label="POWER:" value={<div>{getStr('PCPUPKG')} <span className="text-[9px] opacity-50">W</span></div>} />
      </div>
      <div className="mb-[2px]">
        <StatRow icon={Gauge} label="CLOCK:" value={<div>{getStr('SCPUCLK')} <span className="text-[9px] opacity-50">MHZ</span></div>} />
        <StatRow icon={Activity} label="LOAD:" value={<div>{getStr('SCPUUTI')} <span className="text-[9px] opacity-50">%</span></div>} colorClass={getValueColor(getNum('SCPUUTI'), 'load')} />
      </div>
      <div>
        <StatRow icon={Fan} label="FAN:" value={<div className="flex gap-1"><span>{getStr('FCPU')}</span> <span className="opacity-50 text-[9px] leading-relaxed">/</span> <span>{getStr('FCHA1')}</span> <span className="text-[9px] opacity-50">RPM</span></div>} colorClass={getValueColor(getNum('FCPU'), 'fan')} />
      </div>
      <BarGraph load={getNum('SCPUUTI')} />
    </div>
  </Panel>
);

export const GpuWidget = ({ gpuName, setGpuName, getNum, getStr }: any) => (
  <Panel className="min-w-[240px]">
    <PanelHeader icon={HardDrive} title={gpuName} onTitleChange={setGpuName} />
    <div className="p-1">
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
            <div className="flex flex-col text-[10px] leading-none justify-center ml-1 font-mono">
              <span className="opacity-50">°C</span>
            </div>
          </div>
          <div className="flex items-start ml-2 relative" title="VRAM Temp">
            <div className="absolute -top-3 left-0 text-[8px] text-[var(--accent)] opacity-60">MEM</div>
            <div className={`text-2xl font-light leading-none font-mono ${getValueColor(getNum('TGPU1MEM'), 'temp')}`}>{getStr('TGPU1MEM')}</div>
            <div className="flex flex-col text-[10px] leading-none justify-center ml-1 font-mono">
              <span className="opacity-50">°C</span>
            </div>
          </div>
        </div>
        <div className="flex flex-col text-right text-[12px] font-mono leading-tight mt-1 text-[var(--text-secondary)] tracking-tight">
          <div><span className="opacity-50">FAN1:</span> <span className={getValueColor(getNum('DGPU1'), 'fan_percent')}>{getStr('DGPU1', '0')}%</span></div>
          <div><span className="opacity-50">FAN2:</span> <span className={getValueColor(getNum('DGPU1GPU2'), 'fan_percent')}>{getStr('DGPU1GPU2', '0')}%</span></div>
        </div>
      </div>
      
      <div className="mb-[2px]">
        <StatRow icon={Zap} label="VOLTAGE:" value={<div>{getStr('VGPU1')} <span className="text-[9px] opacity-50">V</span></div>} colorClass={getValueColor(getNum('VGPU1'), 'voltage_gpu')} />
        <StatRow icon={Plug} label="POWER:" value={<div className="flex gap-1 items-baseline"><span>{getStr('PGPU1')}</span> <span className="text-[9px] opacity-50">W</span> <span className="opacity-50 font-normal">[{getStr('PGPU1TDPP')}%]</span></div>} />
      </div>
      <div className="mb-[2px]">
        <StatRow icon={Gauge} label="CLOCK:" value={<div className="flex gap-1"><span>{getStr('SGPU1CLK')}</span> <span className="opacity-50 text-[9px] leading-relaxed">/</span> <span>{getStr('SGPU1MEMCLK')}</span> <span className="text-[9px] opacity-50">MHZ</span></div>} />
      </div>
      <div>
        <StatRow icon={Activity} label="VRAM:" value={<div>{getStr('SUSEDVMEM')} <span className="text-[9px] opacity-50">MB</span></div>} colorClass={getValueColor((getNum('SUSEDVMEM') / 16384) * 100, 'ram')} />
      </div>
      <BarGraph load={getNum('SGPU1UTI')} />
    </div>
  </Panel>
);

export const RamWidget = ({ getNum, getStr }: any) => {
  const memUsed = getNum('SUSEDMEM');
  const memFree = getNum('SFREEMEM');
  const memTotal = memUsed + memFree || 1;
  return (
    <Panel className="min-w-[240px] relative overflow-hidden">
      <div 
        className="absolute top-0 left-0 h-full transition-all duration-500 ease-out z-0"
        style={{
           width: `${(memUsed / memTotal) * 100}%`,
           backgroundColor: getGlowColor((memUsed / memTotal) * 100, 'ram'),
           opacity: 0.15
        }}
      />
      <div className="relative z-10">
        <PanelHeader icon={MemoryStick} title="RAM" rightText={<div>{getStr('SUSEDMEM')} / {memTotal} <span className="opacity-50 text-[10px]">MB</span></div>} />
      </div>
    </Panel>
  );
};

export const NetworkWidget = ({ networkName, setNetworkName, nicIndex, getStr, getNum, onContextMenu }: any) => {
  const dnRate = getNum(`SNIC${nicIndex}DLRATE`);
  const isDownloading = dnRate > 0.1;
  
  return (
    <Panel className="min-w-[240px]">
      <div onContextMenu={onContextMenu} className="cursor-context-menu" title="Right click to change Network Adapter">
        <PanelHeader icon={Globe} title={networkName} onTitleChange={setNetworkName} rightText={<div>{getStr(`SNIC${nicIndex}CONNSPD`)} <span className="opacity-50 text-[10px]">MBPS</span></div>} />
        <div className="p-1 py-1">
          <StatRow icon={Download} label={<div className="flex items-center gap-1">DOWNLOAD <span className={`w-1.5 h-1.5 rounded-full ${isDownloading ? 'bg-[var(--accent)] animate-pulse shadow-[0_0_5px_var(--accent)]' : 'bg-transparent'}`}></span></div>} value={<div>{getStr(`SNIC${nicIndex}DLRATE`)} <span className="opacity-50 text-[9px]">KB/S</span></div>} />
          <StatRow icon={Upload} label="UPLOAD:" value={<div>{getStr(`SNIC${nicIndex}ULRATE`)} <span className="opacity-50 text-[9px]">KB/S</span></div>} />
          <StatRow icon={Network} label="LOCAL IP:" value={getStr('SPRIIIPADDR', '127.0.0.1')} />
        </div>
      </div>
    </Panel>
  );
};
