import React from 'react';

const GlobalStyles = () => (
  <style>{`
    @keyframes we-spin { 100% { transform: rotate(360deg); } }
    @keyframes we-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
    @keyframes we-rain { 
      0% { transform: translateY(-4px) translateX(2px); opacity: 0; } 
      20% { opacity: 1; } 
      80% { opacity: 1; } 
      100% { transform: translateY(12px) translateX(-6px); opacity: 0; } 
    }
    @keyframes we-snow { 
      0% { transform: translateY(-4px) rotate(0deg); opacity: 0; } 
      20% { opacity: 1; } 
      80% { opacity: 1; } 
      100% { transform: translateY(12px) rotate(180deg); opacity: 0; } 
    }
    @keyframes we-flash { 
      0%, 40%, 60%, 100% { opacity: 1; filter: drop-shadow(0 0 0px transparent); } 
      50% { opacity: 0; filter: drop-shadow(0 0 8px currentColor); transform: scale(1.05); } 
    }
    @keyframes we-drift { 
      0%, 100% { transform: translateX(0); } 
      50% { transform: translateX(6px); } 
    }
    .we-spin-anim { transform-origin: center; animation: we-spin 8s linear infinite; }
    .we-float-anim { animation: we-float 4s ease-in-out infinite; }
    .we-flash-anim { transform-origin: center; animation: we-flash 3s infinite; }
  `}</style>
);

const Sun = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 64 64" className={className} width="1em" height="1em">
    <g stroke="currentColor" fill="none" strokeWidth="4" strokeLinecap="round">
      <circle cx="32" cy="32" r="12" fill="currentColor" fillOpacity="0.2" />
      <g className="we-spin-anim" style={{ transformOrigin: '32px 32px' }}>
        {[0, 45, 90, 135, 180, 225, 270, 315].map(deg => (
          <line key={deg} x1="32" y1="6" x2="32" y2="13" transform={`rotate(${deg} 32 32)`} />
        ))}
      </g>
    </g>
  </svg>
);

const Cloud = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 64 64" className={className} width="1em" height="1em">
    <path className="we-float-anim" d="M 20 44 a 10 10 0 0 1 0 -20 a 14 14 0 0 1 26 2 a 10 10 0 0 1 2 18 z" fill="currentColor" fillOpacity="0.95" />
  </svg>
);

const PartlyCloudy = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 64 64" className={className} width="1em" height="1em">
    <g stroke="currentColor" fill="none" strokeWidth="3" strokeLinecap="round">
      <g className="we-spin-anim" style={{ transformOrigin: '22px 22px' }}>
        <circle cx="22" cy="22" r="8" fill="currentColor" fillOpacity="0.2" />
        {[0, 45, 90, 135, 180, 225, 270, 315].map(deg => (
          <line key={deg} x1="22" y1="4" x2="22" y2="10" transform={`rotate(${deg} 22 22)`} />
        ))}
      </g>
    </g>
    <path className="we-float-anim" d="M 26 48 a 8 8 0 0 1 0 -16 a 12 12 0 0 1 22 2 a 8 8 0 0 1 2 14 z" fill="currentColor" fillOpacity="0.95" />
  </svg>
);

const Rain = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 64 64" className={className} width="1em" height="1em">
    <path className="we-float-anim" d="M 20 40 a 10 10 0 0 1 0 -20 a 14 14 0 0 1 26 2 a 10 10 0 0 1 2 18 z" fill="currentColor" fillOpacity="0.95" />
    <g stroke="currentColor" strokeWidth="3" strokeLinecap="round">
      <line x1="24" y1="40" x2="20" y2="48" style={{ animation: 'we-rain 1s linear infinite' }} />
      <line x1="32" y1="40" x2="28" y2="48" style={{ animation: 'we-rain 1s linear infinite 0.33s' }} />
      <line x1="40" y1="40" x2="36" y2="48" style={{ animation: 'we-rain 1s linear infinite 0.66s' }} />
    </g>
  </svg>
);

const Snow = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 64 64" className={className} width="1em" height="1em">
    <path className="we-float-anim" d="M 20 40 a 10 10 0 0 1 0 -20 a 14 14 0 0 1 26 2 a 10 10 0 0 1 2 18 z" fill="currentColor" fillOpacity="0.95" />
    <g stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <g style={{ transformOrigin: '24px 44px', animation: 'we-snow 2s linear infinite' }}>
        <line x1="24" y1="41" x2="24" y2="47" />
        <line x1="21" y1="44" x2="27" y2="44" />
      </g>
      <g style={{ transformOrigin: '32px 46px', animation: 'we-snow 2s linear infinite 0.6s' }}>
        <line x1="32" y1="43" x2="32" y2="49" />
        <line x1="29" y1="46" x2="35" y2="46" />
      </g>
      <g style={{ transformOrigin: '40px 42px', animation: 'we-snow 2s linear infinite 1.2s' }}>
        <line x1="40" y1="39" x2="40" y2="45" />
        <line x1="37" y1="42" x2="43" y2="42" />
      </g>
    </g>
  </svg>
);

const Thunder = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 64 64" className={className} width="1em" height="1em">
    <path className="we-float-anim" d="M 20 38 a 10 10 0 0 1 0 -20 a 14 14 0 0 1 26 2 a 10 10 0 0 1 2 18 z" fill="currentColor" fillOpacity="0.95" />
    <path className="we-flash-anim" d="M 32 38 l -6 10 h 6 l -2 10 l 10 -14 h -6 l 4 -6 z" fill="currentColor" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" style={{ transformOrigin: '32px 48px' }} />
  </svg>
);

const Fog = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 64 64" className={className} width="1em" height="1em">
    <g stroke="currentColor" strokeWidth="4" strokeLinecap="round" fill="none">
      <line x1="16" y1="24" x2="48" y2="24" style={{ animation: 'we-drift 4s ease-in-out infinite' }} />
      <line x1="20" y1="34" x2="44" y2="34" style={{ animation: 'we-drift 4s ease-in-out infinite 1s' }} />
      <line x1="14" y1="44" x2="50" y2="44" style={{ animation: 'we-drift 4s ease-in-out infinite 2s' }} />
    </g>
  </svg>
);

const ICON_MAP: Record<string, React.FC<{ className?: string }>> = {
  '☀': Sun,
  '⛅': PartlyCloudy,
  '🌫': Fog,
  '🌧': Rain,
  '❄': Snow,
  '🌦': Rain,
  '⛈': Thunder,
  '☁': Cloud,
};

interface AnimatedWeatherProps {
  icon: string;
  className?: string;
  scheme?: string;
}

export const AnimatedWeather: React.FC<AnimatedWeatherProps> = ({ icon, className }) => {
  const IconComponent = ICON_MAP[icon] || Sun;

  return (
    <>
      <GlobalStyles />
      {/* 容器保持 1em 大小不影响外部排版，内部 SVG 使用 transform 放大并允许溢出可见 */}
      <div className={`flex items-center justify-center ${className || ''}`} style={{ width: '1em', height: '1em' }}>
        <div className="flex items-center justify-center w-full h-full" style={{ transform: 'scale(1.8)' }}>
          <IconComponent className="w-full h-full overflow-visible" />
        </div>
      </div>
    </>
  );
};
