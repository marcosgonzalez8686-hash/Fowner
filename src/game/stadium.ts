import { ESTADIO_JORNADAS_OBRA, STANDING, fmtMoney, roundMoney } from './economy';
import { diff } from './difficulty';
import { addMessage } from './market';
import type { GameState } from './types';

// Modelos de estadio y tamaño en el terreno: el estadio ocupa 2x2 parcelas y, al crecer,
// 3x3 y 4x4 (hace falta tener ese terreno comprado y libre).

export type StadiumModel = 'clasico' | 'bol' | 'atletismo' | 'municipal' | 'futurista';

export interface StadiumModelInfo {
  name: string;
  icon: string;
  desc: string;
  /** lo que aporta, en una frase */
  effect: string;
  /** multiplicador del precio por asiento */
  seatCost: number;
  /** ventaja de jugar en casa (se suma a la que da el aforo) */
  ambiente: number;
  /** multiplicador de la asistencia */
  attendance: number;
  /** multiplicador del mantenimiento de las gradas */
  upkeep: number;
  /** multiplicador de los ingresos de tienda y bar */
  commercial: number;
  /** aforo máximo (si lo tiene) */
  maxCapacity?: number;
}

export const STADIUM_MODELS: Record<StadiumModel, StadiumModelInfo> = {
  clasico: {
    name: 'Clásico inglés', icon: '🏴',
    desc: 'Cuatro tribunas separadas, pegadas al campo, con tejados a dos aguas.',
    effect: 'Más ambiente: algo más de ventaja en casa.',
    seatCost: 1, ambiente: 0.3, attendance: 1, upkeep: 1, commercial: 1,
  },
  bol: {
    name: 'Bol moderno', icon: '🥣',
    desc: 'Gradas cerradas alrededor del campo y un anillo de cubierta.',
    effect: '+4% de asistencia, pero mantener las gradas cuesta un 30% más.',
    seatCost: 1, ambiente: 0, attendance: 1.04, upkeep: 1.3, commercial: 1,
  },
  atletismo: {
    name: 'Con pista de atletismo', icon: '🏃',
    desc: 'Un óvalo ancho, con la pista roja entre el campo y la grada.',
    effect: 'Asientos un 20% más baratos, pero el público queda lejos: menos ventaja en casa.',
    seatCost: 0.8, ambiente: -0.3, attendance: 1, upkeep: 1, commercial: 1,
  },
  municipal: {
    name: 'Municipal', icon: '🏘️',
    desc: 'Tribuna principal cubierta y gradas bajas en los demás lados.',
    effect: 'Asientos un 15% más baratos, pero no pasa de 15.000 espectadores.',
    seatCost: 0.85, ambiente: 0, attendance: 1, upkeep: 1, commercial: 1, maxCapacity: 15_000,
  },
  futurista: {
    name: 'Futurista', icon: '✨',
    desc: 'Una fachada que se ilumina con los colores del club y cubierta completa.',
    effect: '+15% de ingresos de tienda y bar, pero los asientos cuestan un 30% más.',
    seatCost: 1.3, ambiente: 0, attendance: 1, upkeep: 1, commercial: 1.15,
  },
};
export const STADIUM_MODEL_KEYS = Object.keys(STADIUM_MODELS) as StadiumModel[];

export const stadiumModel = (s: GameState): StadiumModel => s.club.stadiumModel ?? 'clasico';
export const modelInfo = (s: GameState) => STADIUM_MODELS[stadiumModel(s)];

/** Lado del bloque de parcelas que ocupa un estadio de ese aforo */
export const FOOTPRINT_STEPS: [desde: number, lado: number][] = [[60_000, 4], [25_000, 3], [0, 2]];
export const footprintFor = (capacity: number) => FOOTPRINT_STEPS.find(([desde]) => capacity > desde)?.[1] ?? 2;

/** Precio por asiento según el tamaño del estadio: las gradas grandes son más caras de levantar */
export const ESTADIO_TRAMOS: [hasta: number, euros: number][] = [[5_000, 150], [15_000, 250], [Infinity, 400]];

/** Coste de ampliar el estadio en `seats` asientos desde el aforo actual */
export function stadiumCost(s: GameState, seats: number) {
  let desde = s.club.capacity;
  const hasta = desde + seats;
  let total = 0;
  for (const [tope, euros] of ESTADIO_TRAMOS) {
    if (desde >= hasta) break;
    if (desde >= tope) continue;
    const tramo = Math.min(hasta, tope) - desde;
    total += tramo * euros;
    desde += tramo;
  }
  return roundMoney(total * diff(s).works * modelInfo(s).seatCost);
}

/** Parcelas que ocupa ahora el estadio: esquina y lado */
export function stadiumBlock(s: GameState) {
  const ps = s.club.land.parcels.filter((p) => p.stadium);
  const x = Math.min(...ps.map((p) => p.x));
  const y = Math.min(...ps.map((p) => p.y));
  return { x, y, n: Math.round(Math.sqrt(ps.length)) };
}

/** Busca un bloque n x n que contenga el estadio actual con todas las parcelas propias y libres */
export function findStadiumBlock(s: GameState, n: number) {
  const b = stadiumBlock(s);
  if (n <= b.n) return { x: b.x, y: b.y };
  const parcela = (x: number, y: number) => s.club.land.parcels.find((p) => p.x === x && p.y === y);
  const LAND_SIZE = Math.round(Math.sqrt(s.club.land.parcels.length));
  const centro = (LAND_SIZE - n) / 2;
  let mejor: { x: number; y: number; d: number } | null = null;
  for (let x = b.x - (n - b.n); x <= b.x; x++) {
    for (let y = b.y - (n - b.n); y <= b.y; y++) {
      if (x < 0 || y < 0 || x + n > LAND_SIZE || y + n > LAND_SIZE) continue;
      let ok = true;
      for (let i = 0; i < n && ok; i++) {
        for (let j = 0; j < n && ok; j++) {
          const p = parcela(x + i, y + j);
          ok = Boolean(p && p.owned && !p.building && !p.rent);
        }
      }
      const d = Math.abs(x - centro) + Math.abs(y - centro);
      if (ok && (!mejor || d < mejor.d)) mejor = { x, y, d };
    }
  }
  return mejor ? { x: mejor.x, y: mejor.y } : null;
}

/** Si una ampliación necesita más terreno: el lado que hará falta y si ya lo tenemos */
export function expansionNeeds(s: GameState, seats: number) {
  const n = footprintFor(s.club.capacity + seats);
  const actual = stadiumBlock(s).n;
  return { n, grows: n > actual, block: n > actual ? findStadiumBlock(s, n) : null };
}

export function expandStadium(s: GameState, seats: number): string | undefined {
  if (s.club.works) return 'Ya hay obras en marcha.';
  const info = modelInfo(s);
  if (info.maxCapacity && s.club.capacity + seats > info.maxCapacity) {
    return `Un estadio ${info.name.toLowerCase()} no pasa de ${info.maxCapacity.toLocaleString('es-ES')} espectadores: cambia de modelo para seguir creciendo.`;
  }
  const coste = stadiumCost(s, seats);
  if (s.club.cash < coste) return 'No hay dinero suficiente.';
  const need = expansionNeeds(s, seats);
  if (need.grows && !need.block) {
    return `Con ese aforo el estadio ocupa ${need.n}×${need.n} parcelas: compra el terreno de alrededor y déjalo libre de edificios.`;
  }
  s.club.cash -= coste;
  s.club.ledger.obras += coste;
  // el estadio ocupa ya el terreno nuevo mientras duran las obras
  if (need.grows && need.block) {
    for (const p of s.club.land.parcels) {
      p.stadium = p.x >= need.block.x && p.x < need.block.x + need.n && p.y >= need.block.y && p.y < need.block.y + need.n;
      if (p.stadium) delete p.decor;
    }
  }
  s.club.works = { kind: 'estadio', matchdaysLeft: ESTADIO_JORNADAS_OBRA, amount: seats };
  addMessage(s, {
    from: 'club',
    title: 'Empiezan las obras del estadio',
    body: `+${seats.toLocaleString('es-ES')} asientos. Estarán listas en ${ESTADIO_JORNADAS_OBRA} jornadas.` + (need.grows ? ` El estadio pasa a ocupar ${need.n}×${need.n} parcelas.` : ''),
  });
}

/** Coste de cambiar el estadio de modelo: rehacer las gradas que ya hay */
export function remodelCost(s: GameState, to: StadiumModel) {
  const sentados = Math.max(0, s.club.capacity - STANDING);
  if (!sentados) return 0;
  return roundMoney(Math.max(40_000, sentados * 60 * STADIUM_MODELS[to].seatCost * diff(s).works));
}

export function remodelStadium(s: GameState, to: StadiumModel): string | undefined {
  if (s.club.works) return 'Ya hay obras en marcha.';
  if (stadiumModel(s) === to) return 'El estadio ya es de ese modelo.';
  const info = STADIUM_MODELS[to];
  if (info.maxCapacity && s.club.capacity > info.maxCapacity) {
    return `Un estadio ${info.name.toLowerCase()} no pasa de ${info.maxCapacity.toLocaleString('es-ES')} espectadores.`;
  }
  const coste = remodelCost(s, to);
  if (s.club.cash < coste) return 'No hay dinero suficiente.';
  s.club.cash -= coste;
  s.club.ledger.obras += coste;
  // sin gradas no hay nada que rehacer: el cambio es inmediato
  if (!coste) {
    s.club.stadiumModel = to;
    return;
  }
  s.club.works = { kind: 'remodelacion', matchdaysLeft: ESTADIO_JORNADAS_OBRA, amount: 0, model: to };
  addMessage(s, {
    from: 'club',
    title: `Empieza la remodelación: ${info.icon} ${info.name}`,
    body: `Coste: ${fmtMoney(coste)}. Estará lista en ${ESTADIO_JORNADAS_OBRA} jornadas. ${info.effect}`,
  });
}
