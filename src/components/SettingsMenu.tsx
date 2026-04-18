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
      <div className="flex flex-col gap-2">
        <span className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider">Theme</span>
        <div className="grid grid-cols-4 gap-2">
          <button onClick={() => setTheme('dark')} className={`p-1.5 rounded border-2 transition-all ${theme === 'dark' ? 'border-[var(--accent)]' : 'border-[var(--border-color)]'}`}>
            <div className="h-6 rounded bg-gradient-to-br from-[#0f1115] to-[#1a1d24]" />
            <div className="text-[8px] text-center mt-1">Dark</div>
          </button>
          <button onClick={() => setTheme('light')} className={`p-1.5 rounded border-2 transition-all ${theme === 'light' ? 'border-[var(--accent)]' : 'border-[var(--border-color)]'}`}>
            <div className="h-6 rounded bg-gradient-to-br from-[#f5f6f8] to-[#ffffff]" />
            <div className="text-[8px] text-center mt-1">Light</div>
          </button>
          <button onClick={() => setTheme('tesla')} className={`p-1.5 rounded border-2 transition-all ${theme === 'tesla' ? 'border-[var(--accent)]' : 'border-[var(--border-color)]'}`}>
            <div className="h-6 rounded bg-gradient-to-br from-[#121212] to-[#1c1c1e]" />
            <div className="text-[8px] text-center mt-1">Tesla</div>
          </button>
          <button onClick={() => setTheme('ferrari')} className={`p-1.5 rounded border-2 transition-all ${theme === 'ferrari' ? 'border-[var(--accent)]' : 'border-[var(--border-color)]'}`}>
            <div className="h-6 rounded bg-gradient-to-br from-[#fafafa] to-[#ffffff]" />
            <div className="text-[8px] text-center mt-1">Ferrari</div>
          </button>
        </div>
      </div>

      {/* Layout Selection */}
      <div className="flex flex-col gap-2">
        <span className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider">Layout</span>
        <div className="flex gap-2">
          <button onClick={() => setLayout('vertical')} className={`flex-1 py-2 rounded-lg border-2 transition-all text-[12px] ${layout === 'vertical' ? 'border-[var(--accent)] bg-[var(--accent)]/10' : 'border-[var(--border-color)]'}`}>
            Vertical
          </button>
          <button onClick={() => setLayout('horizontal')} className={`flex-1 py-2 rounded-lg border-2 transition-all text-[12px] ${layout === 'horizontal' ? 'border-[var(--accent)] bg-[var(--accent)]/10' : 'border-[var(--border-color)]'}`}>
            Horizontal
          </button>
        </div>
      </div>
    </div>
  );
};
