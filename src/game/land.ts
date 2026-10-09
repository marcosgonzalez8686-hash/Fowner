import { COSTE_INSTALACION, NIVEL_MAX, STANDING, fmtMoney, roundMoney } from './economy';
import { modelInfo } from './stadium';
import { addMessage } from './market';
import { refreshSponsorOffers } from './sponsor';
import { changeSatisfaction } from './fans';
import { diff } from './difficulty';
import type { GameState } from './types';

// Terreno del club: una cuadrícula de parcelas. El estadio ocupa 2x2 en el centro
// y en el resto de parcelas propias se construyen instalaciones.

export const LAND_SIZE = 8;
export { STANDING };
/** Posición por defecto del estadio (esquina superior izquierda del bloque 2x2) */
export const DEFAULT_STADIUM = { x: 3, y: 3 };

/** Edificios que se pueden construir en una parcela (uno de cada tipo) */
export type BuildingKind =
  | 'entrenamiento' | 'cantera' | 'parking' | 'tienda' | 'bar' | 'medico' | 'ojeadores' | 'museo'
  | 'hotel' | 'fanzone' | 'sede' | 'solar' | 'campoFilial';

export interface Parcel {
  x: number;
  y: number;
  owned: boolean;
  stadium?: boolean;
  building?: BuildingKind;
  /** alquilada a un vecino: da dinero pero no se puede usar */
  rent?: { tenant: Tenant; perSeason: number; ending?: boolean };
  /** decoración: se quita sola si se construye encima */
  decor?: Decor;
}

export type Tenant = 'huerto' | 'mercadillo' | 'aparcamiento' | 'vivero';
export type Decor = 'jardin' | 'fuente' | 'plaza';

export interface Land {
  parcels: Parcel[];
  bought: number; // parcelas compradas (encarece las siguientes)
  levels: Partial<Record<BuildingKind, number>>; // niveles de los edificios nuevos
}

export interface BuildingInfo {
  name: string;
  icon: string;
  help: string;
  maxLevel: number;
  /** coste de construir el nivel 1, 2, 3... */
  cost: number[];
  /** parcelas que ocupa (ancho x fondo): se reservan todas desde el nivel 1 */
  size: [number, number];
  /** para qué sirven las parcelas de más (si ocupa más de una) */
  grows?: string;
}

export const BUILDINGS: Record<BuildingKind, BuildingInfo> = {
  entrenamiento: {
    name: 'Ciudad deportiva', icon: '🏋️', maxLevel: NIVEL_MAX,
    help: 'Los jugadores jóvenes mejoran más rápido.',
    cost: [0, 40_000, ...COSTE_INSTALACION.slice(2)],
    size: [2, 2], grows: 'Nuevos campos de entrenamiento en los niveles 2, 3 y 5.',
  },
  cantera: {
    name: 'Residencia de cantera', icon: '🌱', maxLevel: NIVEL_MAX,
    help: 'Salen más juveniles, mejores y con más potencial.',
    cost: [0, 35_000, ...COSTE_INSTALACION.slice(2)],
    size: [2, 1], grows: 'Un campo para los juveniles desde el nivel 3.',
  },
  parking: {
    name: 'Aparcamiento', icon: '🅿️', maxLevel: 3,
    help: 'Más facilidades para venir: +6% de asistencia por nivel.',
    cost: [0, 30_000, 120_000, 450_000],
    size: [2, 1], grows: 'Más plazas en el nivel 2 y un edificio de plantas en el 3.',
  },
  tienda: {
    name: 'Tienda oficial', icon: '👕', maxLevel: 3,
    help: 'Venta de camisetas: ingresos en cada partido en casa según tu afición.',
    cost: [0, 25_000, 110_000, 400_000],
    size: [1, 1],
  },
  bar: {
    name: 'Bar del estadio', icon: '🍺', maxLevel: 3,
    help: 'Cada espectador gasta algo más: ingresos por partido en casa.',
    cost: [0, 20_000, 90_000, 320_000],
    size: [1, 1],
  },
  medico: {
    name: 'Centro médico', icon: '🩺', maxLevel: 3,
    help: 'Los veteranos pierden nivel más despacio con la edad.',
    cost: [0, 60_000, 220_000, 750_000],
    size: [1, 1],
  },
  ojeadores: {
    name: 'Oficina de ojeadores', icon: '🔭', maxLevel: 3,
    help: 'Tu director deportivo valora mejor a los jugadores.',
    cost: [0, 50_000, 190_000, 650_000],
    size: [1, 1],
  },
  museo: {
    name: 'Museo del club', icon: '🏛️', maxLevel: 3,
    help: 'Aumenta la afición cada temporada y los ingresos de patrocinio.',
    cost: [0, 80_000, 300_000, 1_000_000],
    size: [1, 1],
  },
  hotel: {
    name: 'Hotel del club', icon: '🏨', maxLevel: 3,
    help: 'Aficionados visitantes y concentraciones: ingresos en cada partido en casa según tu afición.',
    cost: [0, 120_000, 400_000, 1_200_000],
    size: [1, 1],
  },
  fanzone: {
    name: 'Zona de aficionados', icon: '🎪', maxLevel: 3,
    help: 'Música, pantallas y comida antes del partido: +3% de asistencia y algo más de gasto por espectador por nivel.',
    cost: [0, 45_000, 160_000, 500_000],
    size: [1, 1],
  },
  sede: {
    name: 'Sede del club', icon: '🏢', maxLevel: 3,
    help: 'Oficinas para el área comercial: +4% en los patrocinios por nivel.',
    cost: [0, 90_000, 300_000, 900_000],
    size: [1, 1],
  },
  solar: {
    name: 'Placas solares', icon: '☀️', maxLevel: 3,
    help: 'Energía propia: el mantenimiento de las instalaciones baja un 6% por nivel.',
    cost: [0, 70_000, 220_000, 600_000],
    size: [1, 1],
  },
  campoFilial: {
    name: 'Estadio del filial', icon: '🥅', maxLevel: 3,
    help: 'Si tienes filial, sus jugadores crecen algo más cada temporada.',
    cost: [0, 100_000, 350_000, 1_000_000],
    size: [2, 1], grows: 'Campo y gradas que crecen con el nivel.',
  },
};

/** Texto con lo que ocupa un edificio: "1 parcela" o "2×2 parcelas" */
export const sizeLabel = (k: BuildingKind) => {
  const [w, h] = BUILDINGS[k].size;
  return w * h === 1 ? '1 parcela' : `${w}×${h} parcelas`;
};

/** Parcelas que ocupa un edificio ya construido */
export const buildingParcels = (s: GameState, k: BuildingKind) => s.club.land.parcels.filter((p) => p.building === k);

/** Dónde cabría un edificio usando la parcela (x, y): busca un hueco de su tamaño (en cualquier orientación) que la incluya */
export function placementFor(s: GameState, k: BuildingKind, x: number, y: number): Parcel[] | null {
  const [w, h] = BUILDINGS[k].size;
  const formas = w === h ? [[w, h]] : [[w, h], [h, w]];
  const libre = (px: number, py: number) => {
    const p = parcelAt(s, px, py);
    return p && isFree(p) ? p : null;
  };
  for (const [fw, fh] of formas) {
    // primero con la parcela tocada como esquina; luego desplazando el hueco
    for (let dy = 0; dy < fh; dy++) {
      for (let dx = 0; dx < fw; dx++) {
        const x0 = x - dx;
        const y0 = y - dy;
        const ps: Parcel[] = [];
        for (let j = 0; j < fh; j++) for (let i = 0; i < fw; i++) {
          const p = libre(x0 + i, y0 + j);
          if (p) ps.push(p);
        }
        if (ps.length === fw * fh) return ps;
      }
    }
  }
  return null;
}

/** Partidas antiguas: los edificios grandes intentan ocupar ya su tamaño completo si hay sitio libre al lado */
export function claimFullSize(s: GameState) {
  for (const k of Object.keys(BUILDINGS) as BuildingKind[]) {
    const ps = buildingParcels(s, k);
    const [w, h] = BUILDINGS[k].size;
    if (ps.length !== 1 || w * h === 1) continue;
    const p = ps[0];
    p.building = undefined;
    const sitio = placementFor(s, k, p.x, p.y);
    for (const q of sitio ?? [p]) q.building = k;
  }
}

/** Mantenimiento anual: 6% de lo invertido en cada edificio */
/** Mantenimiento anual: parte de lo invertido en instalaciones */
export const MANTENIMIENTO = 0.1;
/** Mantenimiento anual del estadio por cada asiento de grada */
export const MANTENIMIENTO_ASIENTO = 3;

/** Coste de construir un edificio al nivel indicado (con la dificultad) */
export const buildCost = (s: GameState, k: BuildingKind, nivel: number) => roundMoney(BUILDINGS[k].cost[nivel] * diff(s).works);

/** Ajusta la esquina del estadio para que el bloque 2x2 quepa en el terreno */
export function clampStadium(x: number, y: number) {
  return { x: Math.max(0, Math.min(LAND_SIZE - 2, x)), y: Math.max(0, Math.min(LAND_SIZE - 2, y)) };
}

/** Terreno inicial: solo las 4 parcelas del estadio, donde el dueño haya querido ponerlo */
export function newLand(pos = DEFAULT_STADIUM): Land {
  const { x: ax, y: ay } = clampStadium(pos.x, pos.y);
  const parcels: Parcel[] = [];
  for (let y = 0; y < LAND_SIZE; y++) {
    for (let x = 0; x < LAND_SIZE; x++) {
      const stadium = x >= ax && x <= ax + 1 && y >= ay && y <= ay + 1;
      parcels.push({ x, y, owned: stadium, stadium });
    }
  }
  return { parcels, bought: 0, levels: {} };
}

function stadiumCenter(s: GameState) {
  const c = s.club.land.parcels.filter((p) => p.stadium);
  return { x: c.reduce((a, p) => a + p.x, 0) / c.length, y: c.reduce((a, p) => a + p.y, 0) / c.length };
}

export function buildingLevel(s: GameState, k: BuildingKind) {
  if (k === 'entrenamiento') return s.club.training;
  if (k === 'cantera') return s.club.academy;
  return s.club.land.levels[k] ?? 0;
}

export function parcelAt(s: GameState, x: number, y: number) {
  return s.club.land.parcels.find((p) => p.x === x && p.y === y);
}

/** Solo se puede comprar terreno pegado al que ya tienes */
export function canBuyParcel(s: GameState, p: Parcel) {
  if (p.owned) return false;
  return [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => parcelAt(s, p.x + dx, p.y + dy)?.owned);
}

export function parcelCost(s: GameState, p: Parcel) {
  // más caro cuanto más compras y cuanto más lejos del estadio
  const centro = stadiumCenter(s);
  const dist = Math.abs(p.x - centro.x) + Math.abs(p.y - centro.y);
  return roundMoney(15_000 * Math.pow(1.3, s.club.land.bought) * (0.8 + dist * 0.08) * diff(s).works);
}

export function buyParcel(s: GameState, x: number, y: number): string | undefined {
  const p = parcelAt(s, x, y);
  if (!p) return 'Esa parcela no existe.';
  if (!canBuyParcel(s, p)) return 'Solo puedes comprar parcelas junto a tu terreno.';
  const coste = parcelCost(s, p);
  if (s.club.cash < coste) return 'No hay dinero suficiente.';
  s.club.cash -= coste;
  s.club.ledger.obras += coste;
  p.owned = true;
  s.club.land.bought++;
}

export function nextLevelCost(s: GameState, k: BuildingKind) {
  const n = buildingLevel(s, k);
  const info = BUILDINGS[k];
  return n >= info.maxLevel ? null : buildCost(s, k, n + 1);
}

export function isBuilt(s: GameState, k: BuildingKind) {
  return s.club.land.parcels.some((p) => p.building === k);
}

export function construct(s: GameState, k: BuildingKind, x: number, y: number): string | undefined {
  const p = parcelAt(s, x, y);
  if (!p || !p.owned || p.stadium || p.building) return 'Necesitas una parcela propia y libre.';
  if (isBuilt(s, k)) return 'Ya tienes ese edificio.';
  // se reserva desde ya todo el terreno que ocupará al máximo nivel
  const sitio = placementFor(s, k, x, y);
  if (!sitio) return `No cabe: necesita ${sizeLabel(k)} propias y libres juntas.`;
  const coste = buildCost(s, k, 1);
  if (s.club.cash < coste) return 'No hay dinero suficiente.';
  s.club.cash -= coste;
  s.club.ledger.obras += coste;
  for (const q of sitio) {
    q.building = k;
    delete q.decor;
  }
  if (k === 'entrenamiento') s.club.training = Math.max(1, s.club.training);
  else if (k === 'cantera') s.club.academy = Math.max(1, s.club.academy);
  else s.club.land.levels[k] = 1;
  addMessage(s, { from: 'club', title: `${BUILDINGS[k].name} construido`, body: `${BUILDINGS[k].help}\nCoste: ${fmtMoney(coste)}.` });
  changeSatisfaction(s, 2, `Nueva instalación: ${BUILDINGS[k].name.toLowerCase()}`);
  // cada instalación abre un nuevo espacio para patrocinadores
  refreshSponsorOffers(s);
}

export function upgrade(s: GameState, k: BuildingKind): string | undefined {
  const coste = nextLevelCost(s, k);
  if (coste === null) return 'Ya está al máximo.';
  if (s.club.cash < coste) return 'No hay dinero suficiente.';
  s.club.cash -= coste;
  s.club.ledger.obras += coste;
  if (k === 'entrenamiento') s.club.training++;
  else if (k === 'cantera') s.club.academy++;
  else s.club.land.levels[k] = (s.club.land.levels[k] ?? 0) + 1;
}

/** Parcela propia sin nada que estorbe (la decoración no cuenta: se quita al construir) */
export const isFree = (p: Parcel) => p.owned && !p.stadium && !p.building && !p.rent;

// ---------- alquiler de parcelas ----------

export const TENANTS: Record<Tenant, { name: string; icon: string }> = {
  huerto: { name: 'Huertos vecinales', icon: '🥬' },
  mercadillo: { name: 'Mercadillo de los domingos', icon: '🛍️' },
  aparcamiento: { name: 'Aparcamiento de un vecino', icon: '🚗' },
  vivero: { name: 'Vivero de plantas', icon: '🌳' },
};
/** Lo que paga un inquilino por una parcela y temporada, según la categoría */
const RENTA_DIV = [36_000, 16_000, 7_000, 3_500, 1_800];

export function rentOffer(s: GameState, p: Parcel) {
  const t = s.teams.find((x) => x.id === s.club.teamId)!;
  // cuanto más cerca del estadio, más vale
  const centro = stadiumCenter(s);
  const dist = Math.abs(p.x - centro.x) + Math.abs(p.y - centro.y);
  return roundMoney(RENTA_DIV[t.division] * (1.2 - Math.min(0.5, dist * 0.06)) * diff(s).income);
}

/** Lo que cobramos de alquileres por temporada */
export const rentPerSeason = (s: GameState) => s.club.land.parcels.reduce((a, p) => a + (p.rent?.perSeason ?? 0), 0);

export function rentParcel(s: GameState, x: number, y: number): string | undefined {
  const p = parcelAt(s, x, y);
  if (!p || !isFree(p)) return 'Solo se pueden alquilar parcelas propias y libres.';
  const inquilinos = Object.keys(TENANTS) as Tenant[];
  const tenant = inquilinos[(x * 3 + y * 5 + s.season) % inquilinos.length];
  p.rent = { tenant, perSeason: rentOffer(s, p) };
  delete p.decor;
  addMessage(s, {
    from: 'club',
    title: `${TENANTS[tenant].icon} Parcela alquilada`,
    body: `${TENANTS[tenant].name} pagará ${fmtMoney(p.rent.perSeason)} por temporada, repartidos jornada a jornada. El contrato se renueva solo cada verano.`,
  });
}

/** No renovar: el inquilino se va al acabar la temporada */
export function endRent(s: GameState, x: number, y: number, now = false): string | undefined {
  const p = parcelAt(s, x, y);
  if (!p?.rent) return 'Esa parcela no está alquilada.';
  if (!now) {
    p.rent.ending = !p.rent.ending;
    return;
  }
  // recuperarla ya tiene una indemnización: la cuarta parte del alquiler anual
  const pago = roundMoney(p.rent.perSeason * 0.25);
  if (s.club.cash < pago) return 'No hay dinero para la indemnización.';
  s.club.cash -= pago;
  s.club.ledger.alquileres = (s.club.ledger.alquileres ?? 0) - pago;
  delete p.rent;
}

/** Fin de temporada: se van los que no renuevan y los demás actualizan el precio a la nueva categoría */
export function rentsEndSeason(s: GameState) {
  for (const p of s.club.land.parcels) {
    if (!p.rent) continue;
    if (p.rent.ending) delete p.rent;
    else p.rent.perSeason = rentOffer(s, p);
  }
}

// ---------- decoración ----------

export const DECOR: Record<Decor, { name: string; icon: string; cost: number; help: string }> = {
  jardin: { name: 'Jardín', icon: '🌷', cost: 6_000, help: 'Césped, flores, árboles y bancos.' },
  fuente: { name: 'Fuente', icon: '⛲', cost: 18_000, help: 'Una fuente con los colores del club.' },
  plaza: { name: 'Plaza de las leyendas', icon: '🗿', cost: 35_000, help: 'Una estatua por cada leyenda retirada con partido homenaje (hasta 4).' },
};

/** Leyendas del club (retirados con partido homenaje): las de la plaza */
export const legends = (s: GameState) => (s.club.records.retired ?? []).filter((r) => r.tribute).map((r) => r.name);

export const decorCost = (s: GameState, d: Decor) => roundMoney(DECOR[d].cost * diff(s).works);

export function decorate(s: GameState, x: number, y: number, d: Decor): string | undefined {
  const p = parcelAt(s, x, y);
  if (!p || !isFree(p)) return 'Necesitas una parcela propia y libre.';
  if (d === 'plaza' && s.club.land.parcels.some((q) => q.decor === 'plaza')) return 'Ya tienes la plaza de las leyendas.';
  const coste = decorCost(s, d);
  if (s.club.cash < coste) return 'No hay dinero suficiente.';
  s.club.cash -= coste;
  s.club.ledger.obras += coste;
  // solo la primera vez que se pone cada tipo gusta a la afición
  if (!s.club.land.parcels.some((q) => q.decor === d)) changeSatisfaction(s, d === 'plaza' && legends(s).length ? 2 : 1, `${DECOR[d].name} en los terrenos del club`);
  p.decor = d;
}

export function removeDecor(s: GameState, x: number, y: number) {
  const p = parcelAt(s, x, y);
  if (p) delete p.decor;
}

/** Coste anual de mantener todas las instalaciones */
export function maintenancePerSeason(s: GameState) {
  let total = 0;
  for (const k of Object.keys(BUILDINGS) as BuildingKind[]) {
    const n = buildingLevel(s, k);
    const invertido = BUILDINGS[k].cost.slice(1, n + 1).reduce((a, b) => a + b, 0);
    total += invertido * MANTENIMIENTO;
  }
  // las gradas también hay que mantenerlas
  total += Math.max(0, s.club.capacity - STANDING) * MANTENIMIENTO_ASIENTO * modelInfo(s).upkeep;
  // las placas solares abaratan la factura
  return roundMoney(total * (1 - 0.06 * lvl(s, 'solar')));
}

/** Ingresos comerciales de un partido en casa (tienda + bar) */
const lvl = buildingLevel;

export function commercialPerMatch(s: GameState, attendance: number, fans: number) {
  // los ídolos de la grada venden camisetas aunque no haya tienda
  const idolos = s.players.filter((p) => p.teamId === s.club.teamId && p.traits?.includes('idolo')).length;
  const base = (fans * 0.45 * lvl(s, 'tienda') + attendance * 1.2 * lvl(s, 'bar')) * (1 + 0.08 * idolos) + fans * 0.1 * idolos;
  // hotel (visitantes y concentraciones) y zona de aficionados
  const extra = fans * 0.3 * lvl(s, 'hotel') + attendance * 0.5 * lvl(s, 'fanzone');
  return Math.round((base + extra) * modelInfo(s).commercial);
}

export const attendanceBonus = (s: GameState) => (1 + 0.06 * lvl(s, 'parking') + 0.03 * lvl(s, 'fanzone')) * modelInfo(s).attendance;
export const sponsorBonus = (s: GameState) => 1 + 0.05 * lvl(s, 'museo') + 0.04 * lvl(s, 'sede');
export const fansGrowthBonus = (s: GameState) => 1 + 0.025 * lvl(s, 'museo');
export const scoutingFactor = (s: GameState) => 1 - 0.18 * lvl(s, 'ojeadores');
export const agingFactor = (s: GameState) => 1 - 0.18 * lvl(s, 'medico');
