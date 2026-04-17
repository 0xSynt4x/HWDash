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
            <span>°C</span>
            <span className={getNum('TCPU') >= 85 ? "text-[#ff0055] animate-pulse" : "text-[var(--text-secondary)] opacity-0"}>TOO</span>
            <span className={getNum('TCPU') >= 85 ? "text-[#ff0055] animate-pulse" : "text-[var(--text-secondary)] opacity-0"}>HOT</span>
          </div>
        </div>
        <div className="flex flex-col text-right text-[12px] font-mono leading-tight mt-1 text-[var(--text-secondary)]">
          <div>CHIP: <span className={getValueColor(getNum('TCHIP'), 'temp')}>{getStr('TCHIP')}°C</span></div>
          <div>PCH: <span className={getValueColor(getNum('TPCHDIO'), 'temp')}>{getStr('TPCHDIO')}°C</span></div>
        </div>
      </div>
      <StatRow icon={Zap} label="CORE VOLTAGE:" value={`${getStr('VCPU')} V`} colorClass={getValueColor(getNum('VCPU'), 'voltage_cpu')} />
      <StatRow icon={Plug} label="POWER:" value={`${getStr('PCPUPKG')} W`} />
      <StatRow icon={Gauge} label="CORE CLOCK:" value={`${getStr('SCPUCLK')} MHZ`} />
      <StatRow icon={Fan} label="FAN:" value={`${getStr('FCPU')} RPM`} colorClass={getValueColor(getNum('FCPU'), 'fan')} />
      <StatRow icon={Activity} label="CORE LOAD:" value={`${getStr('SCPUUTI')} %`} colorClass={getValueColor(getNum('SCPUUTI'), 'load')} />
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
          <div className="flex items-start">
            <div className={`text-4xl font-light leading-none font-mono ${getValueColor(getNum('TGPU1'), 'temp')}`}>{getStr('TGPU1')}</div>
            <div className="flex flex-col text-[10px] leading-none justify-center ml-1 font-mono">
              <span>°C</span>
              <span className={getNum('TGPU1') >= 85 ? "text-[#ff0055] animate-pulse" : "text-[var(--text-secondary)] opacity-0"}>TOO</span>
              <span className={getNum('TGPU1') >= 85 ? "text-[#ff0055] animate-pulse" : "text-[var(--text-secondary)] opacity-0"}>HOT</span>
            </div>
          </div>
          <div className="flex items-start ml-1">
            <div className={`text-4xl font-light leading-none font-mono ${getValueColor(getNum('TGPU1MEM'), 'temp')}`}>{getStr('TGPU1MEM')}</div>
            <div className="flex flex-col text-[10px] leading-none justify-center ml-1 font-mono">
              <span>°C</span>
              <span className={getNum('TGPU1MEM') >= 85 ? "text-[#ff0055] animate-pulse" : "text-[var(--text-secondary)] opacity-0"}>TOO</span>
              <span className={getNum('TGPU1MEM') >= 85 ? "text-[#ff0055] animate-pulse" : "text-[var(--text-secondary)] opacity-0"}>HOT</span>
            </div>
          </div>
        </div>
        <div className="flex flex-col text-right text-[12px] font-mono leading-tight mt-1 text-[var(--text-secondary)]">
          <div>FAN1: <span className={getValueColor(getNum('DGPU1'), 'fan_percent')}>{getStr('DGPU1')}%</span></div>
          <div>FAN2: <span className={getValueColor(getNum('DGPU1GPU2'), 'fan_percent')}>{getStr('DGPU1GPU2')}%</span></div>
        </div>
      </div>
      <StatRow icon={Zap} label="CORE VOLTAGE:" value={`${getStr('VGPU1')} V`} colorClass={getValueColor(getNum('VGPU1'), 'voltage_gpu')} />
      <StatRow icon={Plug} label="POWER:" value={`${getStr('PGPU1')} W`} />
      <StatRow icon={Gauge} label="CORE CLOCK:" value={`${getStr('SGPU1CLK')} MHZ`} />
      <StatRow icon={Gauge} label="VRAM CLOCK:" value={`${getStr('SGPU1MEMCLK')} MHZ`} />
      <StatRow icon={Activity} label="VRAM USAGE:" value={`${getStr('SUSEDVMEM')} MB`} colorClass={getValueColor((getNum('SUSEDVMEM') / 16384) * 100, 'ram')} />
      <BarGraph load={(getNum('SUSEDVMEM') / 16384) * 100} />
    </div>
  </Panel>
);

export const RamWidget = ({ getNum, getStr }: any) => {
  const memUsed = getNum('SUSEDMEM');
  const memFree = getNum('SFREEMEM');
  const memTotal = memUsed + memFree || 1;
  return (
    <Panel className="min-w-[240px]">
      <PanelHeader icon={MemoryStick} title="RAM" rightText={`${getStr('SUSEDMEM')} / ${memTotal} MB`} />
      <div className="p-1">
         <div className="w-full h-2 bg-[var(--border-color)] rounded-full mt-2 overflow-hidden">
            <div
              className="h-full transition-all"
              style={{
                width: `${(memUsed / memTotal) * 100}%`,
                backgroundColor: getGlowColor((memUsed / memTotal) * 100, 'ram'),
                boxShadow: `0 0 10px ${getGlowColor((memUsed / memTotal) * 100, 'ram')}`
              }}
            ></div>
         </div>
      </div>
    </Panel>
  );
};

export const NetworkWidget = ({ networkName, setNetworkName, nicIndex, getStr, onContextMenu }: any) => (
  <Panel className="min-w-[240px]">
    <div onContextMenu={onContextMenu} className="cursor-context-menu" title="Right click to change Network Adapter">
      <PanelHeader icon={Globe} title={networkName} onTitleChange={setNetworkName} rightText={`${getStr(`SNIC${nicIndex}CONNSPD`)} MBPS`} />
      <div className="p-1 py-1">
        <StatRow icon={Download} label="DOWNLOAD:" value={`${getStr(`SNIC${nicIndex}DLRATE`)} KB/S`} />
        <StatRow icon={Upload} label="UPLOAD:" value={`${getStr(`SNIC${nicIndex}ULRATE`)} KB/S`} />
        <StatRow icon={Network} label="LOCAL IP:" value={getStr('SPRIIIPADDR', '127.0.0.1')} />
      </div>
    </div>
  </Panel>
);
