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
  const safeX = Math.min(x, window.innerWidth - 180);
  const safeY = Math.min(y, window.innerHeight - 280);

  const themes: Theme[] = ['dark', 'light', 'tesla', 'ferrari'];
  const layouts: Layout[] = ['vertical', 'horizontal'];

  return (
    <div
      className="fixed z-[100] bg-[var(--bg-panel)] border border-[var(--border-color)] rounded shadow-2xl py-2 font-mono text-[12px] backdrop-blur-md flex flex-col min-w-[150px]"
      style={{ top: safeY, left: safeX }}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.stopPropagation()}
    >
      {/* 标题栏 */}
      <div className="px-3 py-1 flex justify-between items-center text-[var(--text-secondary)] border-b border-[var(--border-color)]/50 mb-1">
        <span className="uppercase tracking-widest font-bold">Settings</span>
        <button onClick={onClose} className="hover:text-[var(--accent)] transition-colors text-[12px]">✕</button>
      </div>

      {/* 主题选择 (极简列表风格) */}
      <div className="px-3 pt-2 pb-1 text-[10px] text-[var(--text-secondary)] opacity-60 uppercase tracking-widest">
        Theme
      </div>
      {themes.map((t) => (
        <div
          key={t}
          className={`px-4 py-1.5 cursor-pointer uppercase transition-colors hover:bg-[var(--accent)]/20 ${theme === t ? 'text-[var(--accent)] font-bold' : 'text-[var(--text-primary)]'}`}
          onClick={() => { setTheme(t); }}
        >
          {/* 用一个简单的符号表示当前选中状态，更有终端感 */}
          <span className="inline-block w-4">{theme === t ? '›' : ''}</span>
          {t}
        </div>
      ))}

      <div className="mx-2 my-1 border-t border-[var(--border-color)]/30"></div>

      {/* 布局选择 */}
      <div className="px-3 pt-1 pb-1 text-[10px] text-[var(--text-secondary)] opacity-60 uppercase tracking-widest">
        Layout
      </div>
      {layouts.map((l) => (
        <div
          key={l}
          className={`px-4 py-1.5 cursor-pointer uppercase transition-colors hover:bg-[var(--accent)]/20 ${layout === l ? 'text-[var(--accent)] font-bold' : 'text-[var(--text-primary)]'}`}
          onClick={() => { setLayout(l); }}
        >
          <span className="inline-block w-4">{layout === l ? '›' : ''}</span>
          {l}
        </div>
      ))}
    </div>
  );
};