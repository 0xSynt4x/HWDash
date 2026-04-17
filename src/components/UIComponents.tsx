import React, { useState, useEffect } from 'react';

export const Panel = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className={`flex flex-col mb-2 bg-[var(--bg-panel)] backdrop-blur-[10px] border border-[var(--border-color)] rounded-[4px] p-2 ${className}`}>
    {children}
  </div>
);

export const PanelHeader = ({ icon: Icon, title, rightText, onTitleChange }: { icon?: any; title: string; rightText?: React.ReactNode; onTitleChange?: (newTitle: string) => void }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(title);

  const handleBlur = () => {
    setIsEditing(false);
    if (onTitleChange && editValue.trim() !== '') {
      onTitleChange(editValue);
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
    <div className="flex items-center justify-between font-mono text-[12px] uppercase tracking-[2px] text-[var(--accent)] mb-2">
      <div className="flex items-center gap-1 flex-1">
        {Icon && <Icon size={14} strokeWidth={2} />}
        {isEditing ? (
          <input
            autoFocus
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            className="bg-transparent border-b border-[var(--accent)] outline-none text-[var(--accent)] w-full"
          />
        ) : (
          <span
            onClick={() => onTitleChange && setIsEditing(true)}
            className={onTitleChange ? "cursor-text hover:text-[var(--text-primary)] transition-colors" : ""}
          >
            {title}
          </span>
        )}
      </div>
      {rightText && <span className="ml-2">{rightText}</span>}
    </div>
  );
};

export const StatRow = ({ icon: Icon, label, value, colorClass = "text-[var(--text-primary)]" }: { icon?: any; label: string | React.ReactNode; value: string | React.ReactNode; colorClass?: string }) => (
  <div className="flex items-center justify-between px-1 py-[3px] font-mono text-[12px] leading-none">
    <div className="flex items-center gap-1.5 text-[var(--text-secondary)]">
      {Icon && <Icon size={12} />}
      <span>{label}</span>
    </div>
    <div className={colorClass}>{value}</div>
  </div>
);

export const BarGraph = ({ load = 0 }: { load?: number }) => {
  const [history, setHistory] = useState<number[]>(Array(40).fill(0));
  useEffect(() => { setHistory(prev => [...prev.slice(1), load]); }, [load]);
  return (
    <div className="flex items-end justify-between h-8 px-1 pt-1 pb-0.5 gap-[2px]">
      {history.map((h, i) => (
        <div key={i} className="w-full bg-[var(--border-color)] relative" style={{ height: '100%' }}>
          <div className="absolute bottom-0 w-full bg-[var(--accent)] shadow-[0_0_10px_var(--accent)] transition-all duration-300" style={{ height: `${h}%` }}></div>
        </div>
      ))}
    </div>
  );
};

export const DynamicLineGraph = ({ cpuPower = 0, gpuPower = 0, fps = 0 }: { cpuPower?: number, gpuPower?: number, fps?: number }) => {
  const [history, setHistory] = useState<{cpu: number, gpu: number, fps: number}[]>(Array(50).fill({cpu: 0, gpu: 0, fps: 0}));
  useEffect(() => { setHistory(prev => [...prev.slice(1), { cpu: cpuPower, gpu: gpuPower, fps: fps }]); }, [cpuPower, gpuPower, fps]);
  const maxValues = { cpu: 120, gpu: 320, fps: 75 };
  const createPoints = (key: 'cpu' | 'gpu' | 'fps') => {
    return history.map((data, i) => {
      const x = (i / (history.length - 1)) * 100;
      const y = 100 - (Math.min(data[key], maxValues[key]) / maxValues[key]) * 100;
      return `${x},${y}`;
    }).join(' ');
  };
  return (
    <svg className="w-full h-full absolute inset-0" preserveAspectRatio="none" viewBox="0 0 100 100">
      <polyline points={createPoints('cpu')} fill="none" stroke="#ff00ff" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      <polyline points={createPoints('gpu')} fill="none" stroke="#00d4ff" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      <polyline points={createPoints('fps')} fill="none" stroke="#ffff00" strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
  );
};
