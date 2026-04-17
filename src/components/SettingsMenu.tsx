import React from 'react';

export type Theme = 'dark' | 'light' | 'tesla' | 'ferrari';
export type Layout = 'vertical' | 'horizontal';

interface SettingsMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  theme: Theme;
  setTheme: (t: Theme) => void;
  layout: Layout;
  setLayout: (l: Layout) => void;
}

export const SettingsMenu: React.FC<SettingsMenuProps> = ({
  x, y, onClose, theme, setTheme, layout, setLayout
}) => {
  // Prevent menu from going off-screen
  const safeX = Math.min(x, window.innerWidth - 200);
  const safeY = Math.min(y, window.innerHeight - 300);

  return (
    <div
      className={`fixed z-[100] bg-[var(--bg-panel)] border border-[var(--border-color)] rounded shadow-xl py-2 px-3 flex flex-col gap-3 backdrop-blur-md`}
      style={{ top: safeY, left: safeX, color: 'var(--text-primary)', minWidth: '180px' }}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.stopPropagation()}
    >
      <div className="flex justify-between items-center border-b border-[var(--border-color)] pb-1 mb-1">
        <span className="text-[12px] font-bold">Settings</span>
        <button onClick={onClose} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]">✕</button>
      </div>

      {/* Theme Selection */}
      <div className="flex flex-col gap-1">
        <span className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider">Theme</span>
        <div className="flex flex-col gap-1 text-[12px]">
          <label className="flex items-center gap-1 cursor-pointer">
            <input type="radio" checked={theme === 'dark'} onChange={() => setTheme('dark')} /> Dark
          </label>
          <label className="flex items-center gap-1 cursor-pointer">
            <input type="radio" checked={theme === 'light'} onChange={() => setTheme('light')} /> Light
          </label>
          <label className="flex items-center gap-1 cursor-pointer">
            <input type="radio" checked={theme === 'tesla'} onChange={() => setTheme('tesla')} /> Tesla
          </label>
          <label className="flex items-center gap-1 cursor-pointer">
            <input type="radio" checked={theme === 'ferrari'} onChange={() => setTheme('ferrari')} /> Ferrari
          </label>
        </div>
      </div>

      {/* Layout Selection */}
      <div className="flex flex-col gap-1">
        <span className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider">Layout</span>
        <div className="flex gap-2 text-[12px]">
          <label className="flex items-center gap-1 cursor-pointer">
            <input type="radio" checked={layout === 'vertical'} onChange={() => setLayout('vertical')} /> Vertical
          </label>
          <label className="flex items-center gap-1 cursor-pointer">
            <input type="radio" checked={layout === 'horizontal'} onChange={() => setLayout('horizontal')} /> Horizontal
          </label>
        </div>
      </div>
    </div>
  );
};
