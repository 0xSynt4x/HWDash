import React, { useState, useEffect } from 'react';
import type { LucideIcon } from 'lucide-react';

interface PanelProps {
  children: React.ReactNode;
  className?: string;
}

export const Panel: React.FC<PanelProps> = ({ children, className = '' }) => (
  <div
    className={`flex flex-col mb-1 bg-[var(--glass-bg)] backdrop-blur-md border border-[var(--glass-border)] rounded-md p-2 shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] hover:border-[var(--border-hover)] transition-all duration-300 ${className}`}
  >
    {children}
  </div>
);

interface PanelHeaderProps {
  icon?: LucideIcon;
  title: string;
  rightText?: React.ReactNode;
  onTitleChange?: (newTitle: string) => void;
}

export const PanelHeader: React.FC<PanelHeaderProps> = ({ icon: Icon, title, rightText, onTitleChange }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(title);

  // 当外部 title 变化(例如从设置加载)时同步本地编辑值
  useEffect(() => {
    setEditValue(title);
  }, [title]);

  const handleBlur = () => {
    setIsEditing(false);
    if (onTitleChange && editValue.trim() !== '') {
      onTitleChange(editValue.trim());
    } else {
      setEditValue(title);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleBlur();
    else if (e.key === 'Escape') {
      setIsEditing(false);
      setEditValue(title);
    }
  };

  return (
    <div className="flex items-center justify-between font-mono text-[14px] uppercase tracking-[2px] text-[var(--accent)] mb-1 px-1 border-b border-[var(--border-color)]/50 pb-1">
      <div className="flex items-center gap-2 flex-1">
        {Icon && <Icon size={13} strokeWidth={2} className="opacity-80" />}
        {isEditing ? (
          <input
            autoFocus
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            className="bg-transparent border-b border-[var(--accent)] outline-none text-[var(--accent)] w-full font-semibold"
          />
        ) : (
          <span
            onClick={() => onTitleChange && setIsEditing(true)}
            className={
              onTitleChange
                ? 'cursor-text hover:text-[var(--text-primary)] transition-colors font-semibold'
                : 'font-semibold'
            }
          >
            {title}
          </span>
        )}
      </div>
      {rightText && <span className="ml-2 text-[10px]">{rightText}</span>}
    </div>
  );
};

interface StatRowProps {
  icon?: LucideIcon;
  label: string | React.ReactNode;
  value: string | React.ReactNode;
  colorClass?: string;
}

export const StatRow: React.FC<StatRowProps> = ({
  icon: Icon,
  label,
  value,
  colorClass = 'text-[var(--text-primary)]',
}) => (
  <div className="flex items-center justify-between px-1 py-0 font-mono text-[13px] hover:bg-[var(--bg-gradient-1)]/30 transition-colors rounded">
    <div className="flex items-center gap-2 text-[var(--text-secondary)] w-28 shrink-0">
      {Icon && <Icon size={12} className="opacity-60 shrink-0" />}
      <span className="truncate">{label}</span>
    </div>
    <div className={`font-mono ${colorClass} text-right shrink-0`}>{value}</div>
  </div>
);

interface BarGraphProps {
  load?: number;
}

export const BarGraph: React.FC<BarGraphProps> = ({ load = 0 }) => {
  const [history, setHistory] = useState<number[]>(() => Array(30).fill(0));
  useEffect(() => {
    setHistory((prev) => [...prev.slice(1), load]);
  }, [load]);
  return (
    <div className="flex items-end justify-between h-7 px-1 pt-1 gap-[2px]">
      {history.map((h, i) => {
        const opacity = Math.max(0.3, (i + 1) / history.length);
        return (
          <div key={i} className="w-full bg-[var(--border-color)]/30 rounded-t-sm relative" style={{ height: '100%' }}>
            <div
              className="absolute bottom-0 w-full rounded-t-sm transition-all duration-300"
              style={{
                height: `${Math.max(2, h)}%`,
                backgroundColor: 'var(--accent)',
                opacity,
                boxShadow: i === history.length - 1 ? '0 0 8px var(--accent-glow)' : 'none',
              }}
            />
          </div>
        );
      })}
    </div>
  );
};

interface DynamicLineGraphProps {
  cpuPower?: number;
  gpuPower?: number;
  fps?: number;
}

interface HistoryPoint {
  cpu: number;
  gpu: number;
  fps: number;
}

export const DynamicLineGraph: React.FC<DynamicLineGraphProps> = ({
  cpuPower = 0,
  gpuPower = 0,
  fps = 0,
}) => {
  const [history, setHistory] = useState<HistoryPoint[]>(() =>
    Array(60).fill({ cpu: 0, gpu: 0, fps: 0 })
  );
  useEffect(() => {
    setHistory((prev) => [...prev.slice(1), { cpu: cpuPower, gpu: gpuPower, fps }]);
  }, [cpuPower, gpuPower, fps]);

  const maxValues = { cpu: 150, gpu: 350, fps: 144 };

  const createPath = (key: 'cpu' | 'gpu' | 'fps') => {
    return history
      .map((data, i) => {
        const x = (i / (history.length - 1)) * 100;
        const y = 100 - (Math.min(data[key], maxValues[key]) / maxValues[key]) * 100;
        return `${x},${y}`;
      })
      .join(' ');
  };

  const lastCpu = history[history.length - 1]?.cpu ?? 0;

  return (
    <div className="relative w-full h-full">
      <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
        {[0, 25, 50, 75, 100].map((y) => (
          <line
            key={y}
            x1="0"
            y1={`${y}%`}
            x2="100%"
            y2={`${y}%`}
            stroke="var(--border-color)"
            strokeWidth="0.5"
            opacity="0.3"
            strokeDasharray="2,2"
          />
        ))}
      </svg>

      <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 100">
        <polyline points={createPath('cpu')} fill="none" stroke="var(--chart-cpu)" strokeWidth="1.5" opacity="0.9" />
        <polyline points={createPath('gpu')} fill="none" stroke="var(--chart-gpu)" strokeWidth="1.5" opacity="0.9" />
        <polyline points={createPath('fps')} fill="none" stroke="var(--chart-fps)" strokeWidth="1.5" opacity="0.9" />
        <circle
          cx="99"
          cy={100 - (Math.min(lastCpu, maxValues.cpu) / maxValues.cpu) * 100}
          r="2"
          fill="var(--chart-cpu)"
          opacity="0.8"
        />
      </svg>
    </div>
  );
};
