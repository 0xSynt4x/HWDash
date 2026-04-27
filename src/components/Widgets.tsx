import React from 'react';
import {
  Cpu,
  HardDrive,
  MemoryStick,
  Globe,
  Zap,
  Plug,
  Gauge,
  Fan,
  Activity,
  Download,
  Upload,
  Network,
} from 'lucide-react';
import { Panel, PanelHeader, StatRow, BarGraph } from './UIComponents';
import { getValueColor, getGlowColor } from '../utils/colors';

type GetStr = (key: string, fallback?: string) => string;
type GetNum = (key: string) => number;

interface CpuWidgetProps {
  cpuName: string;
  setCpuName: (v: string) => void;
  getStr: GetStr;
  getNum: GetNum;
}

interface GpuWidgetProps {
  gpuName: string;
  setGpuName: (v: string) => void;
  getStr: GetStr;
  getNum: GetNum;
}

interface RamWidgetProps {
  getStr: GetStr;
  getNum: GetNum;
}

interface NetworkWidgetProps {
  networkName: string;
  setNetworkName: (v: string) => void;
  nicIndex: number;
  getStr: GetStr;
  getNum: GetNum;
  onContextMenu: (e: React.MouseEvent) => void;
}

export const CpuWidget: React.FC<CpuWidgetProps> = ({ cpuName, setCpuName, getNum, getStr }) => (
  <Panel className="min-w-[240px] h-full flex flex-col">
    <PanelHeader icon={Cpu} title={cpuName} onTitleChange={setCpuName} />
    <div className="p-0.5 flex flex-col flex-1">
      <div className="flex justify-between items-start mb-1 px-1">
        <div className="flex items-center gap-2">
          <div className="w-4 h-8 border border-[var(--border-color)] rounded-sm flex flex-col justify-end p-[1px] bg-[rgba(255,255,255,0.05)]">
            <div
              className="w-full transition-all"
              style={{
                height: `${Math.min(100, getNum('TCPU'))}%`,
                backgroundColor: getGlowColor(getNum('TCPU'), 'temp'),
                boxShadow: `0 0 10px ${getGlowColor(getNum('TCPU'), 'temp')}`,
              }}
            />
          </div>
          <div className={`font-digital text-4xl font-light leading-none ${getValueColor(getNum('TCPU'), 'temp')}`}>
            {getStr('TCPU')}
          </div>
          <div className="flex flex-col text-[13px] leading-none justify-center font-mono">
            <span className="opacity-50">°C</span>
            <span className={getNum('TCPU') >= 85 ? 'text-[#ff0055] animate-pulse' : 'opacity-0'}>⚠</span>
          </div>
        </div>
        <div className="flex flex-col text-right text-[13px] font-mono leading-tight mt-1 text-[var(--text-secondary)] tracking-tight">
          <div>
            <span className="opacity-50">CHIP:</span>{' '}
            <span className={`font-digital ${getValueColor(getNum('TCHIP'), 'temp')}`}>{getStr('TCHIP', '--')}</span>
            <span className="opacity-50">°C</span>
          </div>
          <div>
            <span className="opacity-50">VRM:</span>{' '}
            <span className={`font-digital ${getValueColor(getNum('TVRM'), 'temp')}`}>{getStr('TVRM', '--')}</span>
            <span className="opacity-50">°C</span>
          </div>
        </div>
      </div>
      <StatRow
        icon={Zap}
        label="VOLTAGE:"
        value={
          <div>
            <span className="font-digital">{getStr('VCPU')}</span> <span className="text-[13px] opacity-50">V</span>
          </div>
        }
        colorClass={getValueColor(getNum('VCPU'), 'voltage_cpu')}
      />
      <StatRow
        icon={Plug}
        label="POWER:"
        value={
          <div>
            <span className="font-digital">{getStr('PCPUPKG')}</span> <span className="text-[13px] opacity-50">W</span>
          </div>
        }
      />
      <StatRow
        icon={Gauge}
        label="CLOCK:"
        value={
          <div>
            <span className="font-digital">{getStr('SCPUCLK')}</span> <span className="text-[13px] opacity-50">MHZ</span>
          </div>
        }
      />
      <StatRow
        icon={Activity}
        label="LOAD:"
        value={
          <div>
            <span className="font-digital">{getStr('SCPUUTI')}</span> <span className="text-[13px] opacity-50">%</span>
          </div>
        }
        colorClass={getValueColor(getNum('SCPUUTI'), 'load')}
      />
      <StatRow
        icon={Fan}
        label="FAN:"
        value={
          <div className="flex gap-1 items-baseline">
            <span className="font-digital">{getStr('FCPU')}</span>
            <span className="opacity-50 text-[13px]">/</span>
            <span className="font-digital">{getStr('FCHA1')}</span>
            <span className="text-[13px] opacity-50">RPM</span>
          </div>
        }
        colorClass={getValueColor(getNum('FCPU'), 'fan')}
      />
      <div className="mt-auto pt-1 w-full">
        <BarGraph load={getNum('SCPUUTI')} />
      </div>
    </div>
  </Panel>
);

export const GpuWidget: React.FC<GpuWidgetProps> = ({ gpuName, setGpuName, getNum, getStr }) => {
  // 优先使用 AIDA64 提供的 SVMEMUSAGE 百分比;否则回退到 used/(used+free)
  const vmemPct = (() => {
    const direct = getNum('SVMEMUSAGE');
    if (direct > 0) return direct;
    const used = getNum('SUSEDVMEM');
    const free = getNum('SFREEVMEM');
    const total = used + free;
    return total > 0 ? (used / total) * 100 : 0;
  })();

  return (
    <Panel className="min-w-[240px] h-full flex flex-col">
      <PanelHeader icon={HardDrive} title={gpuName} onTitleChange={setGpuName} />
      <div className="p-0.5 flex flex-col flex-1">
        <div className="flex justify-between items-start mb-1 px-1">
          <div className="flex items-center gap-1">
            <div className="w-4 h-8 border border-[var(--border-color)] rounded-sm flex flex-col justify-end p-[1px] bg-[rgba(255,255,255,0.05)]">
              <div
                className="w-full transition-all"
                style={{
                  height: `${Math.min(100, getNum('TGPU1'))}%`,
                  backgroundColor: getGlowColor(getNum('TGPU1'), 'temp'),
                  boxShadow: `0 0 10px ${getGlowColor(getNum('TGPU1'), 'temp')}`,
                }}
              />
            </div>
            <div className="flex items-start" title="GPU Core Temp">
              <div className={`font-digital text-4xl font-light leading-none ${getValueColor(getNum('TGPU1'), 'temp')}`}>
                {getStr('TGPU1')}
              </div>
              <div className="flex flex-col text-[13px] leading-none justify-center ml-1 font-mono">
                <span className="opacity-50">°C</span>
              </div>
            </div>
            <div className="flex items-start ml-2 relative" title="VRAM Temp">
              <div className="absolute -top-3 left-0 text-[9px] text-[var(--accent)] opacity-60">MEM</div>
              <div className={`font-digital text-2xl font-light leading-none ${getValueColor(getNum('TGPU1MEM'), 'temp')}`}>
                {getStr('TGPU1MEM')}
              </div>
              <div className="flex flex-col text-[13px] leading-none justify-center ml-1 font-mono">
                <span className="opacity-50">°C</span>
              </div>
            </div>
          </div>
          <div className="flex flex-col text-right text-[13px] font-mono leading-tight mt-1 text-[var(--text-secondary)] tracking-tight">
            <div>
              <span className="opacity-50">FAN1:</span>{' '}
              <span className={`font-digital ${getValueColor(getNum('DGPU1'), 'fan_percent')}`}>{getStr('DGPU1', '0')}</span>
              <span className="opacity-50">%</span>
            </div>
            <div>
              <span className="opacity-50">FAN2:</span>{' '}
              <span className={`font-digital ${getValueColor(getNum('DGPU1GPU2'), 'fan_percent')}`}>{getStr('DGPU1GPU2', '0')}</span>
              <span className="opacity-50">%</span>
            </div>
          </div>
        </div>

        <StatRow
          icon={Zap}
          label="VOLTAGE:"
          value={
            <div>
              <span className="font-digital">{getStr('VGPU1')}</span> <span className="text-[13px] opacity-50">V</span>
            </div>
          }
          colorClass={getValueColor(getNum('VGPU1'), 'voltage_gpu')}
        />
        <StatRow
          icon={Plug}
          label="POWER:"
          value={
            <div className="flex gap-1 items-baseline">
              <span className="font-digital">{getStr('PGPU1')}</span> <span className="text-[13px] opacity-50">W</span>{' '}
              <span className="opacity-50 font-normal text-[13px]">[<span className="font-digital">{getStr('PGPU1TDPP')}</span>%]</span>
            </div>
          }
        />
        <StatRow
          icon={Gauge}
          label="CLOCK:"
          value={
            <div className="flex gap-1 items-baseline">
              <span className="font-digital">{getStr('SGPU1CLK')}</span>
              <span className="opacity-50 text-[13px]">/</span>
              <span className="font-digital">{getStr('SGPU1MEMCLK')}</span>
              <span className="text-[13px] opacity-50">MHZ</span>
            </div>
          }
        />
        <StatRow
          icon={Activity}
          label="VRAM:"
          value={
            <div>
              <span className="font-digital">{getStr('SUSEDVMEM')}</span> <span className="text-[13px] opacity-50">MB</span>
            </div>
          }
          colorClass={getValueColor(vmemPct, 'ram')}
        />
        <div className="mt-auto pt-1 w-full">
          <BarGraph load={getNum('SGPU1UTI')} />
        </div>
      </div>
    </Panel>
  );
};

export const RamWidget: React.FC<RamWidgetProps> = ({ getNum, getStr }) => {
  const memUsed = getNum('SUSEDMEM');
  const memFree = getNum('SFREEMEM');
  const memTotal = memUsed + memFree || 1;
  const usagePercent = (memUsed / memTotal) * 100;

  return (
    <Panel className="min-w-[240px] relative overflow-hidden flex-shrink-0 !p-1">
      <div
        className="absolute top-0 left-0 h-full transition-all duration-700 ease-out z-0"
        style={{
          width: `${usagePercent}%`,
          background:
            'linear-gradient(90deg, rgba(15, 43, 51, 0.6) 0%, rgba(17, 66, 73, 0.4) 100%)',
        }}
      />

      <div className="relative z-10 flex items-center justify-between font-mono text-[15px] uppercase tracking-[2px] text-[var(--accent)] px-2 py-1 w-full leading-none">
        <div className="flex items-center gap-2 flex-1">
          <MemoryStick size={14} strokeWidth={2} className="opacity-80" />
          <span className="font-semibold leading-none">MEMORY</span>
        </div>
        <div className="ml-2 text-[13px] flex items-baseline gap-1">
          <span className="font-digital text-[var(--accent)] leading-none">{getStr('SUSEDMEM')}</span>
          <span className="opacity-50 text-[11px] leading-none">/</span>
          <span className="font-digital opacity-70 text-[12px] leading-none">{memTotal}</span>
        </div>
      </div>
    </Panel>
  );
};

export const NetworkWidget: React.FC<NetworkWidgetProps> = ({
  networkName,
  setNetworkName,
  nicIndex,
  getStr,
  getNum,
  onContextMenu,
}) => {
  const hasNic = nicIndex >= 0;
  const dnRate = hasNic ? getNum(`SNIC${nicIndex}DLRATE`) : 0;
  const ulRate = hasNic ? getNum(`SNIC${nicIndex}ULRATE`) : 0;
  const isDownloading = dnRate > 0.1;
  const isUploading = ulRate > 0.1;

  return (
    <Panel className="min-w-[240px]">
      <div onContextMenu={onContextMenu} className="cursor-context-menu" title="Right click to change Network Adapter">
        <PanelHeader
          icon={Globe}
          title={networkName}
          onTitleChange={setNetworkName}
          rightText={
            <div className="flex items-baseline gap-1">
              <span className={hasNic ? 'font-digital text-sm' : 'font-mono text-sm'}>
                {hasNic ? getStr(`SNIC${nicIndex}TOTDL`, '0') : '—'}
              </span>
              <span className="text-[13px] opacity-50">MB</span>
            </div>
          }
        />
        <div className="p-1 space-y-1">
          <div className="flex items-center gap-2">
            <div
              className={`flex-1 flex items-center gap-1.5 p-1 rounded border ${
                isDownloading
                  ? 'bg-[var(--bg-gradient-1)]/50 border-[var(--accent)]/30'
                  : 'border-[var(--border-color)]/50'
              }`}
            >
              <Download
                size={12}
                className={isDownloading ? 'text-[var(--accent)] animate-bounce' : 'text-[var(--text-muted)]'}
              />
              <span className={hasNic ? 'font-digital text-xs' : 'font-mono text-xs'}>
                {hasNic ? getStr(`SNIC${nicIndex}DLRATE`, '0') : '—'}
              </span>
              <span className="text-[9px] text-[var(--text-muted)]">↓</span>
            </div>
            <div
              className={`flex-1 flex items-center gap-1.5 p-1 rounded border ${
                isUploading
                  ? 'bg-[var(--bg-gradient-2)]/50 border-[var(--accent-secondary)]/30'
                  : 'border-[var(--border-color)]/50'
              }`}
            >
              <Upload
                size={12}
                className={isUploading ? 'text-[var(--accent-secondary)]' : 'text-[var(--text-muted)]'}
              />
              <span className={hasNic ? 'font-digital text-xs' : 'font-mono text-xs'}>
                {hasNic ? getStr(`SNIC${nicIndex}ULRATE`, '0') : '—'}
              </span>
              <span className="text-[9px] text-[var(--text-muted)]">↑</span>
            </div>
          </div>

          <div className="flex items-center justify-between p-1 rounded bg-[var(--bg-main)]/50 border border-[var(--border-color)]/50">
            <div className="flex items-center gap-1">
              <Network size={10} className="text-[var(--text-muted)]" />
              <span className="text-[13px] uppercase tracking-wider text-[var(--text-secondary)]">IP</span>
            </div>
            <span className="font-mono text-[13px]">{getStr('SPRIIPADDR', '127.0.0.1')}</span>
          </div>
        </div>
      </div>
    </Panel>
  );
};
