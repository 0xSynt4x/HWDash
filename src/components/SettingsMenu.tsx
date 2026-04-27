import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import type { AppSettings, Theme, Layout } from '../hooks/useSettings';

export type { Theme, Layout };

interface SettingsMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  settings: AppSettings;
  update: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
}

interface LocationPreset {
  name: string;
  lat: number;
  lon: number;
}

const LOCATION_PRESETS: LocationPreset[] = [
  { name: 'Urumqi', lat: 43.8, lon: 87.6 },
  { name: 'Beijing', lat: 39.9, lon: 116.4 },
  { name: 'Shanghai', lat: 31.23, lon: 121.47 },
  { name: 'Shenzhen', lat: 22.54, lon: 114.06 },
  { name: 'Tokyo', lat: 35.68, lon: 139.69 },
  { name: 'New York', lat: 40.71, lon: -74.0 },
  { name: 'London', lat: 51.51, lon: -0.13 },
];

const THEMES: Theme[] = ['dark', 'light', 'tesla', 'ferrari'];
const LAYOUTS: Layout[] = ['vertical', 'horizontal'];

/* -------------------------------------------------------------- */
/* 通用下拉组件:点击展开,选中后收起                              */
/* -------------------------------------------------------------- */
interface DropdownProps {
  value: string;
  options: { label: string; value: string }[];
  onChange: (value: string) => void;
}

const Dropdown: React.FC<DropdownProps> = ({ value, options, onChange }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const current = options.find((o) => o.value === value);

  return (
    <div ref={ref} className="relative w-full">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-2 py-1 text-[12px] uppercase tracking-wider bg-[var(--bg-main)]/40 border border-[var(--border-color)] rounded text-[var(--text-primary)] hover:border-[var(--accent)]/50 transition-colors"
      >
        <span>{current?.label ?? value}</span>
        <ChevronDown
          size={12}
          className={`opacity-60 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div className="absolute left-0 right-0 mt-1 z-[110] bg-[var(--bg-panel)] border border-[var(--border-color)] rounded shadow-lg backdrop-blur-md max-h-[180px] overflow-y-auto">
          {options.map((o) => {
            const active = o.value === value;
            return (
              <div
                key={o.value}
                className={`px-3 py-1.5 cursor-pointer text-[12px] uppercase tracking-wider transition-colors ${
                  active
                    ? 'bg-[var(--accent)]/20 text-[var(--accent)] font-bold'
                    : 'text-[var(--text-primary)] hover:bg-[var(--accent)]/10'
                }`}
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
              >
                {o.label}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

/* -------------------------------------------------------------- */

export const SettingsMenu: React.FC<SettingsMenuProps> = ({ x, y, onClose, settings, update }) => {
  // 初步定位安全边界(以紧凑高度估算)
  const safeX = Math.min(x, window.innerWidth - 220);
  const safeY = Math.min(y, window.innerHeight - 360);

  const [latInput, setLatInput] = useState(settings.latitude.toString());
  const [lonInput, setLonInput] = useState(settings.longitude.toString());
  const [showLocCustom, setShowLocCustom] = useState(false);

  const applyCustomLocation = () => {
    const lat = parseFloat(latInput);
    const lon = parseFloat(lonInput);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return;
    update('latitude', lat);
    update('longitude', lon);
    update('location_name', 'Custom');
  };

  // 当前 location 在预设中的匹配
  const currentLocValue = (() => {
    for (const p of LOCATION_PRESETS) {
      if (
        Math.abs(settings.latitude - p.lat) < 0.01 &&
        Math.abs(settings.longitude - p.lon) < 0.01
      ) {
        return p.name;
      }
    }
    return '__custom__';
  })();

  const handleLocChange = (val: string) => {
    if (val === '__custom__') {
      setShowLocCustom(true);
      return;
    }
    const p = LOCATION_PRESETS.find((x) => x.name === val);
    if (!p) return;
    update('latitude', p.lat);
    update('longitude', p.lon);
    update('location_name', p.name);
    setLatInput(p.lat.toString());
    setLonInput(p.lon.toString());
  };

  return (
    <div
      className="fixed z-[100] bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-md shadow-2xl py-2 px-3 font-mono text-[12px] backdrop-blur-md flex flex-col gap-2 w-[200px]"
      style={{ top: safeY, left: safeX }}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.stopPropagation()}
    >
      {/* 标题 */}
      <div className="flex justify-between items-center text-[var(--text-secondary)] border-b border-[var(--border-color)]/50 pb-1">
        <span className="uppercase tracking-widest font-bold text-[11px]">Settings</span>
        <button
          onClick={onClose}
          className="hover:text-[var(--accent)] transition-colors text-[12px] leading-none"
          type="button"
        >
          ✕
        </button>
      </div>

      {/* Theme 下拉 */}
      <div className="flex flex-col gap-1">
        <label className="text-[10px] text-[var(--text-secondary)] opacity-60 uppercase tracking-widest">
          Theme
        </label>
        <Dropdown
          value={settings.theme}
          options={THEMES.map((t) => ({ label: t, value: t }))}
          onChange={(v) => update('theme', v as Theme)}
        />
      </div>

      {/* Layout 按钮组 */}
      <div className="flex flex-col gap-1">
        <label className="text-[10px] text-[var(--text-secondary)] opacity-60 uppercase tracking-widest">
          Layout
        </label>
        <div className="flex gap-1">
          {LAYOUTS.map((l) => {
            const active = settings.layout === l;
            return (
              <button
                key={l}
                type="button"
                onClick={() => update('layout', l)}
                className={`flex-1 px-2 py-1 text-[11px] uppercase tracking-wider rounded border transition-colors ${
                  active
                    ? 'bg-[var(--accent)]/20 text-[var(--accent)] border-[var(--accent)]/60 font-bold'
                    : 'border-[var(--border-color)] text-[var(--text-primary)] hover:border-[var(--accent)]/40'
                }`}
              >
                {l}
              </button>
            );
          })}
        </div>
      </div>

      {/* Location 下拉 */}
      <div className="flex flex-col gap-1">
        <div className="flex justify-between items-center">
          <label className="text-[10px] text-[var(--text-secondary)] opacity-60 uppercase tracking-widest">
            Location
          </label>
          <span className="text-[10px] text-[var(--accent)] opacity-80">
            {settings.location_name}
          </span>
        </div>
        <Dropdown
          value={currentLocValue}
          options={[
            ...LOCATION_PRESETS.map((p) => ({ label: p.name, value: p.name })),
            { label: 'Custom...', value: '__custom__' },
          ]}
          onChange={handleLocChange}
        />
        {showLocCustom && (
          <div className="flex flex-col gap-1 mt-1 p-2 bg-[var(--bg-main)]/40 border border-[var(--border-color)] rounded">
            <label className="flex items-center gap-1 text-[10px] text-[var(--text-secondary)]">
              <span className="w-6">Lat</span>
              <input
                type="number"
                step="0.01"
                value={latInput}
                onChange={(e) => setLatInput(e.target.value)}
                className="flex-1 bg-transparent border border-[var(--border-color)] rounded px-1 py-0.5 outline-none text-[var(--text-primary)] text-[10px] focus:border-[var(--accent)]/50"
              />
            </label>
            <label className="flex items-center gap-1 text-[10px] text-[var(--text-secondary)]">
              <span className="w-6">Lon</span>
              <input
                type="number"
                step="0.01"
                value={lonInput}
                onChange={(e) => setLonInput(e.target.value)}
                className="flex-1 bg-transparent border border-[var(--border-color)] rounded px-1 py-0.5 outline-none text-[var(--text-primary)] text-[10px] focus:border-[var(--accent)]/50"
              />
            </label>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={applyCustomLocation}
                className="flex-1 px-2 py-0.5 border border-[var(--accent)]/50 rounded text-[var(--accent)] hover:bg-[var(--accent)]/20 transition-colors text-[10px] uppercase tracking-widest"
              >
                Apply
              </button>
              <button
                type="button"
                onClick={() => setShowLocCustom(false)}
                className="px-2 py-0.5 border border-[var(--border-color)] rounded text-[var(--text-secondary)] hover:bg-[var(--accent)]/10 transition-colors text-[10px] uppercase tracking-widest"
              >
                Hide
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Zoom */}
      <div className="flex flex-col gap-1">
        <div className="flex justify-between items-center">
          <label className="text-[10px] text-[var(--text-secondary)] opacity-60 uppercase tracking-widest">
            Zoom
          </label>
          <span className="text-[10px] text-[var(--accent)] opacity-80">
            <span className="font-digital">{settings.zoom.toFixed(2)}</span>×
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() =>
              update('zoom', Math.max(0.3, Number((settings.zoom - 0.05).toFixed(2))))
            }
            className="w-6 h-6 border border-[var(--border-color)] rounded text-[var(--text-primary)] hover:bg-[var(--accent)]/20 text-[12px] leading-none"
          >
            −
          </button>
          <input
            type="range"
            min="0.3"
            max="3"
            step="0.05"
            value={settings.zoom}
            onChange={(e) => update('zoom', Number(parseFloat(e.target.value).toFixed(2)))}
            className="flex-1 accent-[var(--accent)]"
          />
          <button
            type="button"
            onClick={() =>
              update('zoom', Math.min(3, Number((settings.zoom + 0.05).toFixed(2))))
            }
            className="w-6 h-6 border border-[var(--border-color)] rounded text-[var(--text-primary)] hover:bg-[var(--accent)]/20 text-[12px] leading-none"
          >
            +
          </button>
          <button
            type="button"
            onClick={() => update('zoom', 1)}
            className="px-2 h-6 border border-[var(--border-color)] rounded text-[var(--text-secondary)] hover:bg-[var(--accent)]/20 text-[10px] uppercase tracking-wider"
            title="Reset to 1.0×"
          >
            1×
          </button>
        </div>
      </div>
    </div>
  );
};
