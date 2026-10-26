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
  ArrowLeftRight,
} from 'lucide-react';
import { Panel, PanelHeader, StatRow } from './UIComponents';
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
          <div className="flex gap-1 items-baseline">
            <span className="font-digital" title="有效频率（所有核里最高的那个）">
              {getStr('SCPUCLKEFF')}
            </span>
            <span className="opacity-50 text-[13px]">/</span>
            <span className="font-digital" title="最高请求频率">
              {getStr('SCPUCLK')}
            </span>
            <span className="text-[13px] opacity-50">MHZ</span>
          </div>
        }
      />
      <StatRow
        icon={Activity}
        label="LOAD:"
        value={
          <div className="flex gap-1 items-baseline">
            <span className="font-digital" title="所有核心的平均占用">
              {getStr('SCPUUTI')}
            </span>
            <span className="opacity-50 text-[13px]">/</span>
            <span className="font-digital" title="单核最高占用（平均值会稀释单核满载）">
              {getStr('SCPUMAX')}
            </span>
            <span className="text-[13px] opacity-50">%</span>
          </div>
        }
        colorClass={getValueColor(getNum('SCPUMAX'), 'load')}
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
    </div>
  </Panel>
);

export const GpuWidget: React.FC<GpuWidgetProps> = ({ gpuName, setGpuName, getNum, getStr }) => {
  // 优先使用 AIDA64 提供的 SVMEMUSAGE 百分比;否则回退到 used/(used+free)
  const vmemPct = (() => {
    const direct = getNum('SVMEMUSAGE');
    if (direct > 0) return direct;
    const used = getNum('SUSEDVMEM');
    const free = getNum('SFREEVEM');
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
              <span className={`font-digital ${getValueColor(getNum('DGPU1'), 'fan')}`}>{getStr('DGPU1', '0')}</span>
              <span className="opacity-50"> RPM</span>
            </div>
            <div>
              <span className="opacity-50">FAN2:</span>{' '}
              <span className={`font-digital ${getValueColor(getNum('DGPU1GPU2'), 'fan')}`}>{getStr('DGPU1GPU2', '0')}</span>
              <span className="opacity-50"> RPM</span>
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
              <span className="font-digital" title="整卡功耗">
                {getStr('PGPU1')}
              </span>
              <span className="text-[13px] opacity-50">W</span>
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
          icon={ArrowLeftRight}
          label="PCIE:"
          value={
            <div className="flex gap-1 items-baseline">
              <span className="font-digital" title="PCIe 接收吞吐">
                {Math.round(getNum('SPCIE1RX'))}
              </span>
              <span className="opacity-50 text-[13px]">/</span>
              <span className="font-digital" title="PCIe 发送吞吐">
                {Math.round(getNum('SPCIE1TX'))}
              </span>
              <span className="text-[13px] opacity-50">MB/S</span>
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
      </div>
    </Panel>
  );
};

export const RamWidget: React.FC<RamWidgetProps> = ({ getNum }) => {
  const memUsed = getNum('SUSEDMEM');
  const memFree = getNum('SFREEMEM');
  const memTotal = memUsed + memFree || 1;
  const usagePercent = (memUsed / memTotal) * 100;

  // 内存条温度(每条一个,读不到就整块不显示)。
  // 占用率已经由底下的色条表达,所以右侧不再显示 MB 数字,让给温度。
  const dimmTemps = [1, 2, 3, 4].map((i) => getNum(`TDIMM${i}`)).filter((t) => t > 0);

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
        <div className="flex items-center gap-2 flex-1 min-w-0 overflow-hidden">
          <MemoryStick size={14} strokeWidth={2} className="opacity-80 shrink-0" />
          <span className="font-semibold leading-none shrink-0">MEMORY</span>
        </div>
        {dimmTemps.length > 0 && (
          <span
            className={`ml-2 shrink-0 font-digital text-[13px] leading-none ${getValueColor(
              Math.max(...dimmTemps),
              'dimm'
            )}`}
          >
            {dimmTemps.map((t) => t.toFixed(1)).join('/')}
            <span className="text-[10px] opacity-70">°C</span>
          </span>
        )}
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
  // 速率单位是 KB/s,门槛取 100 KB/s(等效于原来的 0.1 MB/s)
  const isDownloading = dnRate > 100;
  const isUploading = ulRate > 100;

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
        </div>
      </div>
    </Panel>
  );
};

interface StorageWidgetProps {
  getStr: GetStr;
  getNum: GetNum;
}

/**
 * 硬盘卡片:每块盘一行 —— 盘符 / 温度 / 实时读写速率(MB/s)。
 * 后端按实际磁盘数输出 SDISKxNAME(型号),这里以它是否存在决定显示哪几块盘;
 * 读不到温度的盘显示 "--"。鼠标悬停可看完整型号。
 * 两列排布是为了压高度:四块盘两行就放完,比原来的四宫格矮一半。
 */
export const StorageWidget: React.FC<StorageWidgetProps> = ({ getStr, getNum }) => {
  const disks = [1, 2, 3, 4, 5, 6, 7, 8].filter((i) => getStr(`SDISK${i}NAME`, '') !== '');
  if (disks.length === 0) return null;

  // 读写速率按数值长度自适应:低速保留 1 位小数(1.2 MB/s 有意义),
  // 超过 100 就取整(1234.5 → 1235),否则两列布局里四位数会把格子顶爆。
  const fmtRate = (v: string) => {
    const n = parseFloat(v);
    if (!Number.isFinite(n)) return '0.0';
    return n >= 100 ? String(Math.round(n)) : n.toFixed(1);
  };

  // 双击盘行 → 手动刷新 HDD(sidecar /api/hdd-refresh)。
  // 运行期 HDD 永不自动读(磁头不能被周期性惊动),想看新数据就双击任意盘行
  // —— sidecar 只刷 /hdd/,对 SSD 无副作用。返回体是刷新后的完整数据,
  // 500ms 轮询下一拍会自然带上,这里不用手动 setState。
  const refreshHdd = () => {
    fetch('http://localhost:7453/api/hdd-refresh').catch(() => {});
  };

  return (
    <Panel className="min-w-[240px] !py-1">
      <PanelHeader
        icon={HardDrive}
        title="STORAGE"
        rightText={<span className="opacity-50">MB/S R/W</span>}
      />
      <div className="grid grid-cols-2 gap-x-6 px-1">
        {disks.map((i) => {
          const tempStr = getStr(`TDISK${i}`, '--');
          const tempNum = getNum(`TDISK${i}`);
          const letter = getStr(`SDISK${i}LETTER`, '');
          return (
            <div
              key={i}
              title={getStr(`SDISK${i}NAME`, '')}
              onDoubleClick={refreshHdd}
              className="flex items-center gap-1 font-mono leading-none overflow-hidden cursor-help select-none"
              style={{ height: 18 }}
            >
              <span className="w-4 shrink-0 text-[12px] font-semibold text-[var(--accent)] opacity-70">
                {letter}
              </span>
              <span className={`shrink-0 font-digital text-[13px] ${getValueColor(tempNum, 'temp')}`}>
                {tempStr}
                <span className="text-[9px] opacity-50">°C</span>
              </span>
              <span className="ml-auto shrink-0 font-digital text-[11px] text-[var(--text-secondary)]">
                {fmtRate(getStr(`SDISK${i}R`, '0.0'))}
                <span className="opacity-40">/</span>
                {fmtRate(getStr(`SDISK${i}W`, '0.0'))}
              </span>
            </div>
          );
        })}
      </div>
    </Panel>
  );
};
