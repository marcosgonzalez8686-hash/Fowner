import { useId } from 'react';
import type { Crest as CrestT, CrestShape, CrestSymbol } from '../game/identity';

const SHAPES: Record<CrestShape, string> = {
  clasico: 'M10 8 H90 V60 C90 90 70 106 50 114 C30 106 10 90 10 60 Z',
  frances: 'M10 8 H90 V78 Q90 96 70 100 Q56 102 50 114 Q44 102 30 100 Q10 96 10 78 Z',
  redondo: 'M50 12 A48 48 0 1 1 49.99 12 Z',
  rombo: 'M50 6 L94 60 L50 114 L6 60 Z',
  moderno: 'M20 8 H80 L94 28 V72 L50 114 L6 72 V28 Z',
};

/** Símbolos dibujados en una caja de 40x40 */
function Symbol({ s, color, line }: { s: CrestSymbol; color: string; line: string }) {
  const st = { fill: color, stroke: line, strokeWidth: 1.6, strokeLinejoin: 'round' as const };
  switch (s) {
    case 'balon':
      return (
        <g>
          <circle cx="20" cy="20" r="17" {...st} />
          <path d="M20 11 L28 17 L25 27 H15 L12 17 Z" fill={line} />
          <path d="M20 11 V3 M28 17 L36 14 M25 27 L30 34 M15 27 L10 34 M12 17 L4 14" stroke={line} strokeWidth="1.6" />
        </g>
      );
    case 'estrella':
      return <path d="M20 2 L25 15 L39 15 L28 24 L32 38 L20 30 L8 38 L12 24 L1 15 L15 15 Z" {...st} />;
    case 'corona':
      return (
        <g>
          <path d="M3 30 L6 9 L14 19 L20 5 L26 19 L34 9 L37 30 Z" {...st} />
          <rect x="3" y="31" width="34" height="6" rx="1" {...st} />
        </g>
      );
    case 'torre':
      return (
        <g>
          <path d="M6 38 V13 H11 V7 H16 V13 H24 V7 H29 V13 H34 V38 Z" {...st} />
          <path d="M16 38 V29 A4 4 0 0 1 24 29 V38 Z" fill={line} />
        </g>
      );
    case 'leon':
      return (
        <g>
          <path d="M20 1 L24 7 L31 4 L31 11 L38 13 L34 19 L39 25 L32 27 L32 34 L25 32 L20 39 L15 32 L8 34 L8 27 L1 25 L6 19 L2 13 L9 11 L9 4 L16 7 Z" {...st} />
          <circle cx="20" cy="20" r="9" fill={line} />
          <circle cx="17" cy="18" r="1.4" fill={color} />
          <circle cx="23" cy="18" r="1.4" fill={color} />
          <path d="M17 24 Q20 26 23 24" stroke={color} strokeWidth="1.4" fill="none" />
        </g>
      );
    case 'ola':
      return (
        <g fill="none" stroke={color} strokeWidth="4" strokeLinecap="round">
          <path d="M2 14 Q8 6 14 14 T26 14 T38 14" />
          <path d="M2 24 Q8 16 14 24 T26 24 T38 24" />
          <path d="M2 34 Q8 26 14 34 T26 34 T38 34" />
        </g>
      );
    case 'rayo':
      return <path d="M25 1 L7 23 H18 L13 39 L33 15 H22 Z" {...st} />;
    case 'espiga':
      return (
        <g {...st}>
          <path d="M20 39 V6" fill="none" stroke={color} strokeWidth="2.4" />
          {[8, 15, 22, 29].map((y) => (
            <g key={y}>
              <ellipse cx="14.5" cy={y} rx="5" ry="3" transform={`rotate(-35 14.5 ${y})`} />
              <ellipse cx="25.5" cy={y} rx="5" ry="3" transform={`rotate(35 25.5 ${y})`} />
            </g>
          ))}
          <ellipse cx="20" cy="4" rx="3" ry="4.5" />
        </g>
      );
    default:
      return null;
  }
}

export default function Crest({ c, size = 48, title }: { c: CrestT; size?: number; title?: string }) {
  const id = useId().replace(/:/g, '');
  const shape = SHAPES[c.shape];
  const conSimbolo = c.symbol !== 'ninguno';
  const ini = c.initials.trim().slice(0, 4).toUpperCase();
  const fontSize = ini.length >= 4 ? 17 : ini.length === 3 ? 21 : 26;

  return (
    <svg viewBox="0 0 100 120" width={size} height={size * 1.2} role="img" aria-label={title ?? 'Escudo'}>
      <defs>
        <clipPath id={`c${id}`}>
          <path d={shape} />
        </clipPath>
      </defs>
      <g clipPath={`url(#c${id})`}>
        <rect x="0" y="0" width="100" height="120" fill={c.color1} />
        {c.division === 'partido' && <rect x="50" y="0" width="50" height="120" fill={c.color2} />}
        {c.division === 'cortado' && <rect x="0" y="60" width="100" height="60" fill={c.color2} />}
        {c.division === 'cuartelado' && (
          <>
            <rect x="50" y="0" width="50" height="60" fill={c.color2} />
            <rect x="0" y="60" width="50" height="60" fill={c.color2} />
          </>
        )}
        {c.division === 'banda' && <path d="M-10 18 L18 -10 L110 102 L82 130 Z" fill={c.color2} />}
        {c.division === 'franjas' && [10, 38, 66].map((x) => <rect key={x} x={x + 4} y="0" width="14" height="120" fill={c.color2} />)}
      </g>
      <path d={shape} fill="none" stroke={c.border} strokeWidth="5" strokeLinejoin="round" />
      {conSimbolo && (
        <g transform={ini ? 'translate(30 22)' : 'translate(24 34) scale(1.3)'}>
          <Symbol s={c.symbol} color={c.symbolColor} line={c.border} />
        </g>
      )}
      {ini && (
        <text
          x="50"
          y={conSimbolo ? 90 : 72}
          textAnchor="middle"
          fontFamily="system-ui, Arial, sans-serif"
          fontWeight="900"
          fontSize={conSimbolo ? fontSize : fontSize * 1.35}
          fill={c.symbolColor}
          stroke={c.border}
          strokeWidth="3"
          paintOrder="stroke"
          letterSpacing="1"
        >
          {ini}
        </text>
      )}
    </svg>
  );
}
