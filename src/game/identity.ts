// Identidad del club: dueño, estadio, escudo y equipaciones

export type ShirtPattern = 'liso' | 'rayas' | 'aros' | 'mitades' | 'banda';
export interface Kit {
  shirt: string;
  shirt2: string; // segundo color de la camiseta (rayas, aros...)
  pattern: ShirtPattern;
  shorts: string;
  socks: string;
}

export type CrestShape = 'clasico' | 'redondo' | 'rombo' | 'frances' | 'moderno';
export type CrestDivision = 'liso' | 'partido' | 'cortado' | 'cuartelado' | 'banda' | 'franjas';
export type CrestSymbol = 'ninguno' | 'balon' | 'estrella' | 'corona' | 'torre' | 'leon' | 'ola' | 'rayo' | 'espiga';

export interface Crest {
  shape: CrestShape;
  division: CrestDivision;
  color1: string;
  color2: string;
  border: string;
  symbol: CrestSymbol;
  symbolColor: string;
  initials: string; // hasta 4 letras
}

export interface Identity {
  ownerName: string;
  ownerSurname: string;
  stadium: string;
  crest: Crest;
  home: Kit;
  away: Kit;
}

export const SHIRT_PATTERNS: { value: ShirtPattern; label: string }[] = [
  { value: 'liso', label: 'Lisa' },
  { value: 'rayas', label: 'Rayas' },
  { value: 'aros', label: 'Aros' },
  { value: 'mitades', label: 'Mitades' },
  { value: 'banda', label: 'Banda' },
];

export const CREST_SHAPES: { value: CrestShape; label: string }[] = [
  { value: 'clasico', label: 'Clásico' },
  { value: 'frances', label: 'Francés' },
  { value: 'redondo', label: 'Redondo' },
  { value: 'rombo', label: 'Rombo' },
  { value: 'moderno', label: 'Moderno' },
];

export const CREST_DIVISIONS: { value: CrestDivision; label: string }[] = [
  { value: 'liso', label: 'Liso' },
  { value: 'partido', label: 'Partido' },
  { value: 'cortado', label: 'Cortado' },
  { value: 'cuartelado', label: 'Cuartelado' },
  { value: 'banda', label: 'Banda' },
  { value: 'franjas', label: 'Franjas' },
];

export const CREST_SYMBOLS: { value: CrestSymbol; label: string }[] = [
  { value: 'ninguno', label: 'Ninguno' },
  { value: 'balon', label: 'Balón' },
  { value: 'estrella', label: 'Estrella' },
  { value: 'corona', label: 'Corona' },
  { value: 'torre', label: 'Torre' },
  { value: 'leon', label: 'León' },
  { value: 'ola', label: 'Ola' },
  { value: 'rayo', label: 'Rayo' },
  { value: 'espiga', label: 'Espiga' },
];

/** Paleta rápida de colores */
export const SWATCHES = [
  '#ffffff', '#111111', '#c8102e', '#7a1f2b', '#f26a21', '#f5c542', '#0f8a3c', '#0f5132',
  '#2bb3e6', '#1d4ed8', '#0b1f5c', '#6b2fa3', '#e94b9b', '#9aa3ab',
];

/** Iniciales a partir del nombre del club, sin las siglas habituales */
export function initialsFrom(name: string) {
  const ini = name
    .split(/\s+/)
    .filter((w) => w && !/^(de|del|la|las|los|el|y)$/i.test(w))
    .map((w) => w[0])
    .join('')
    .toUpperCase();
  return (ini || 'F').slice(0, 3);
}

export function defaultIdentity(clubName = 'CD Fowner'): Identity {
  return {
    ownerName: '',
    ownerSurname: '',
    stadium: 'Campo Municipal',
    crest: {
      shape: 'clasico',
      division: 'partido',
      color1: '#0f5132',
      color2: '#f5c542',
      border: '#111111',
      symbol: 'balon',
      symbolColor: '#ffffff',
      initials: initialsFrom(clubName),
    },
    home: { shirt: '#0f5132', shirt2: '#f5c542', pattern: 'liso', shorts: '#ffffff', socks: '#0f5132' },
    away: { shirt: '#ffffff', shirt2: '#0f5132', pattern: 'banda', shorts: '#0f5132', socks: '#ffffff' },
  };
}

/** Nombre con el que te tratan en los mensajes */
export function ownerTitle(id: Identity) {
  return id.ownerSurname ? `presidente ${id.ownerSurname}` : 'presidente';
}

/** Escudo sencillo y estable para los clubes rivales, derivado de su id */
export function rivalCrest(teamId: number, short: string): Crest {
  const h = (n: number) => Math.abs(Math.imul(teamId + 7, 2654435761 + n * 40503)) >>> 0;
  const colores = SWATCHES.filter((c) => c !== '#9aa3ab');
  const c1 = colores[h(1) % colores.length];
  let c2 = colores[h(2) % colores.length];
  if (c2 === c1) c2 = c1 === '#ffffff' ? '#111111' : '#ffffff';
  const formas = CREST_SHAPES.map((x) => x.value);
  const divs = CREST_DIVISIONS.map((x) => x.value);
  return {
    shape: formas[h(3) % formas.length],
    division: divs[h(4) % divs.length],
    color1: c1,
    color2: c2,
    border: '#111111',
    symbol: 'ninguno',
    symbolColor: c1 === '#ffffff' || c2 === '#ffffff' ? '#111111' : '#ffffff',
    initials: short.slice(0, 3),
  };
}
