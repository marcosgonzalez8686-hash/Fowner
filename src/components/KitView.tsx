import { useId } from 'react';
import type { Kit } from '../game/identity';

const CAMISETA = 'M30 8 L42 4 Q50 11 58 4 L70 8 L93 23 L84 41 L74 35 V72 H26 V35 L16 41 L7 23 Z';
const PANTALON = 'M26 74 H74 L79 106 H54 L50 92 L46 106 H21 Z';
const LINEA = 'rgba(0,0,0,0.45)';

export default function KitView({ k, size = 70, label }: { k: Kit; size?: number; label?: string }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg viewBox="0 0 100 150" width={size} height={size * 1.5} role="img" aria-label={label ?? 'Equipación'}>
      <defs>
        <clipPath id={`k${id}`}>
          <path d={CAMISETA} />
        </clipPath>
      </defs>
      <g clipPath={`url(#k${id})`}>
        <rect x="0" y="0" width="100" height="80" fill={k.shirt} />
        {k.pattern === 'rayas' && [33, 47, 61, 75, 19].map((x) => <rect key={x} x={x} y="0" width="7" height="80" fill={k.shirt2} />)}
        {k.pattern === 'aros' && [16, 32, 48, 64].map((y) => <rect key={y} x="0" y={y} width="100" height="8" fill={k.shirt2} />)}
        {k.pattern === 'mitades' && <rect x="50" y="0" width="50" height="80" fill={k.shirt2} />}
        {k.pattern === 'banda' && <path d="M14 0 L32 0 L88 80 L70 80 Z" fill={k.shirt2} />}
      </g>
      <path d={CAMISETA} fill="none" stroke={LINEA} strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M42 4 Q50 11 58 4" fill="none" stroke={k.shirt2} strokeWidth="3" />
      <path d={PANTALON} fill={k.shorts} stroke={LINEA} strokeWidth="1.5" strokeLinejoin="round" />
      {[28, 60].map((x) => (
        <g key={x}>
          <rect x={x} y="110" width="12" height="32" rx="2" fill={k.socks} stroke={LINEA} strokeWidth="1.5" />
          <rect x={x} y="110" width="12" height="5" fill={k.shirt2} opacity="0.85" />
        </g>
      ))}
    </svg>
  );
}
