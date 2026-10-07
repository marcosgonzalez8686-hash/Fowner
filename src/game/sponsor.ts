import { DIV_FANS, DIV_SPONSOR, fmtMoney, roundMoney } from './economy';
import { STANDING, buildingLevel, isBuilt, sponsorBonus, type BuildingKind } from './land';
import { addMessage, myTeam } from './market';
import { clamp, rand, randInt, shuffle } from './rng';
import { marketingSponsorBonus } from './staff';
import type { GameState } from './types';

// Patrocinios por espacios: camiseta, estadio y cada instalación construida.
// Cada contrato tiene un importe anual y una duración en temporadas. Cuando un espacio
// queda libre (nuevo o porque acabó el contrato) llegan tres ofertas para elegir.

export type SponsorSlot = 'camiseta' | 'estadio' | 'entrenamiento' | 'cantera' | 'medico' | 'tienda' | 'bar' | 'parking' | 'museo';

export interface SponsorContract {
  id: number;
  slot: SponsorSlot;
  name: string;
  sector: string;
  annual: number; // € por temporada
  years: number; // duración total
  yearsLeft: number; // temporadas que quedan, incluida la actual
  perWin?: number; // prima por victoria (algunas ofertas de camiseta)
}

interface SlotInfo {
  name: string;
  icon: string;
  /** peso del espacio respecto al patrocinio base de la categoría */
  weight: number;
  building?: BuildingKind;
}

export const SLOTS: Record<SponsorSlot, SlotInfo> = {
  camiseta: { name: 'Camiseta', icon: '👕', weight: 1 },
  estadio: { name: 'Nombre del estadio', icon: '🏟️', weight: 0.55 },
  entrenamiento: { name: 'Ciudad deportiva', icon: '🏋️', weight: 0.18, building: 'entrenamiento' },
  cantera: { name: 'Residencia de cantera', icon: '🌱', weight: 0.14, building: 'cantera' },
  medico: { name: 'Centro médico', icon: '🩺', weight: 0.2, building: 'medico' },
  tienda: { name: 'Marca deportiva (tienda)', icon: '🛍️', weight: 0.22, building: 'tienda' },
  bar: { name: 'Bebida oficial (bar)', icon: '🍺', weight: 0.16, building: 'bar' },
  parking: { name: 'Aparcamiento', icon: '🅿️', weight: 0.1, building: 'parking' },
  museo: { name: 'Museo', icon: '🏛️', weight: 0.15, building: 'museo' },
};

export const SLOT_ORDER = Object.keys(SLOTS) as SponsorSlot[];

const EMPRESAS: [string, string][] = [
  ['Conservas Ribera', 'Alimentación'], ['Talleres Montañés', 'Automoción'], ['Panadería La Espiga', 'Alimentación'],
  ['Construcciones Valdés', 'Construcción'], ['Bodegas Altozano', 'Vinos'], ['Seguros Atalaya', 'Seguros'],
  ['Transportes Galán', 'Logística'], ['Óptica Mirasol', 'Comercio'], ['Muebles Robledo', 'Comercio'],
  ['Energías del Norte', 'Energía'], ['Clínica Dental Sonrisa', 'Salud'], ['Gestoría Pardo', 'Servicios'],
  ['Cervezas Lúpulo Bravo', 'Bebidas'], ['Telecom Rápida', 'Telecomunicaciones'], ['Hotel Mirador', 'Turismo'],
  ['Banca Comarcal', 'Banca'], ['Lácteos Pradoverde', 'Alimentación'], ['Cafés Tostadero', 'Bebidas'],
  ['Farmacia Central', 'Salud'], ['Fisio Vital', 'Salud'], ['Deportes Zancada', 'Material deportivo'],
  ['Calzados Brío', 'Material deportivo'], ['Aguas Manantial Frío', 'Bebidas'], ['Refrescos Burbuja', 'Bebidas'],
  ['Parkings Centro', 'Servicios'], ['Autoescuela Volante', 'Servicios'], ['Fundación Raíces', 'Cultura'],
  ['Editorial Atenea', 'Cultura'], ['Academia Saber', 'Educación'], ['Gimnasios Fibra', 'Deporte'],
];

/** Sector preferido para cada espacio (le da coherencia a las ofertas) */
const SECTOR_PREFERIDO: Partial<Record<SponsorSlot, string[]>> = {
  medico: ['Salud'],
  tienda: ['Material deportivo'],
  bar: ['Bebidas'],
  parking: ['Servicios', 'Automoción'],
  museo: ['Cultura', 'Banca'],
  cantera: ['Educación', 'Alimentación'],
  entrenamiento: ['Deporte', 'Salud', 'Material deportivo'],
};

/** ¿Se puede patrocinar este espacio? y con qué nivel (afecta a la calidad de las ofertas) */
export function slotStatus(s: GameState, slot: SponsorSlot): { available: boolean; level: number; reason?: string } {
  const info = SLOTS[slot];
  if (slot === 'camiseta') return { available: true, level: 3 };
  if (slot === 'estadio') {
    const cap = s.club.capacity;
    if (cap <= STANDING) return { available: false, level: 0, reason: 'Construye gradas para vender el nombre del estadio.' };
    return { available: true, level: clamp(Math.log2(cap / STANDING) + 1, 1, 5) };
  }
  const k = info.building!;
  if (!isBuilt(s, k)) return { available: false, level: 0, reason: `Construye: ${info.name.replace(/ \(.*\)/, '')}.` };
  return { available: true, level: buildingLevel(s, k) };
}

/** Valor anual de referencia de un espacio */
function slotValue(s: GameState, slot: SponsorSlot) {
  const t = myTeam(s);
  const { level } = slotStatus(s, slot);
  const aficion = clamp(0.6 + 0.4 * (t.fans / DIV_FANS[t.division]), 0.5, 2);
  const calidad = 0.7 + 0.15 * level; // mejores instalaciones, mejores patrocinadores
  return DIV_SPONSOR[t.division] * SLOTS[slot].weight * aficion * calidad * sponsorBonus(s) * marketingSponsorBonus(s);
}

function pickCompanies(s: GameState, slot: SponsorSlot, n: number) {
  const ocupadas = new Set(Object.values(s.club.sponsors).map((c) => c!.name));
  const libres = EMPRESAS.filter(([nombre]) => !ocupadas.has(nombre));
  const pref = SECTOR_PREFERIDO[slot];
  const preferidas = shuffle(libres.filter(([, sector]) => pref?.includes(sector)));
  const resto = shuffle(libres.filter(([, sector]) => !pref?.includes(sector)));
  return [...preferidas, ...resto].slice(0, n);
}

/** Tres ofertas: corta y bien pagada, intermedia, o larga y algo más barata por año */
export function makeOffersFor(s: GameState, slot: SponsorSlot): SponsorContract[] {
  const base = slotValue(s, slot);
  const empresas = pickCompanies(s, slot, 3);
  const plantillas = [
    { years: 1, mult: 1.1 },
    { years: randInt(2, 3), mult: 1.0 },
    { years: randInt(3, 4), mult: 0.9 },
  ];
  return plantillas.map((p, i) => {
    const [name, sector] = empresas[i];
    const annual = base * p.mult * rand(0.9, 1.1);
    // en la camiseta, la oferta intermedia puede llevar parte en primas por victoria
    const conPrimas = slot === 'camiseta' && i === 1;
    return {
      id: s.nextId++,
      slot,
      name,
      sector,
      annual: roundMoney(conPrimas ? annual * 0.65 : annual),
      perWin: conPrimas ? roundMoney((annual * 0.6) / 19) : undefined,
      years: p.years,
      yearsLeft: p.years,
    };
  });
}

/** Ingreso fijo anual de todos los patrocinios */
export const sponsorFixed = (s: GameState) =>
  Object.values(s.club.sponsors).reduce((a, c) => a + (c?.annual ?? 0), 0);

export const sponsorPerWin = (s: GameState) =>
  Object.values(s.club.sponsors).reduce((a, c) => a + (c?.perWin ?? 0), 0);

/** Genera ofertas para los espacios disponibles que no tienen contrato ni ofertas */
export function refreshSponsorOffers(s: GameState) {
  const nuevos: SponsorSlot[] = [];
  for (const slot of SLOT_ORDER) {
    if (s.club.sponsors[slot] || s.sponsorOffers[slot]?.length) continue;
    if (!slotStatus(s, slot).available) continue;
    s.sponsorOffers[slot] = makeOffersFor(s, slot);
    nuevos.push(slot);
  }
  if (nuevos.length) {
    addMessage(s, {
      from: 'club',
      title: 'Nuevas ofertas de patrocinio',
      body: `Hay ofertas para: ${nuevos.map((x) => SLOTS[x].name.toLowerCase()).join(', ')}.\nElígelas en Club → Finanzas → Patrocinadores.`,
    });
  }
}

export function signOffer(s: GameState, slot: SponsorSlot, id: number): string | undefined {
  const o = s.sponsorOffers[slot]?.find((x) => x.id === id);
  if (!o) return 'Esa oferta ya no está disponible.';
  if (s.club.sponsors[slot]) return 'Ese espacio ya tiene patrocinador.';
  s.club.sponsors[slot] = { ...o };
  delete s.sponsorOffers[slot];
  addMessage(s, {
    from: 'club',
    title: `Firmado: ${o.name} (${SLOTS[slot].name.toLowerCase()})`,
    body:
      `${fmtMoney(o.annual)} al año durante ${o.years} temporada(s)` +
      (o.perWin ? `, más ${fmtMoney(o.perWin)} por victoria` : '') + '.',
  });
}

/** Fin de temporada: los contratos restan un año y los que terminan dejan el espacio libre */
export function sponsorsEndSeason(s: GameState) {
  const acabados: string[] = [];
  for (const slot of SLOT_ORDER) {
    const c = s.club.sponsors[slot];
    if (!c) continue;
    c.yearsLeft--;
    if (c.yearsLeft <= 0) {
      acabados.push(`${SLOTS[slot].name}: ${c.name}`);
      delete s.club.sponsors[slot];
    }
  }
  if (acabados.length) {
    addMessage(s, { from: 'club', title: 'Contratos de patrocinio terminados', body: acabados.map((x) => `• ${x}`).join('\n') });
  }
  // las ofertas que nadie firmó se renuevan con los datos actuales del club
  s.sponsorOffers = {};
  refreshSponsorOffers(s);
}

/** Para partidas guardadas con el sistema anterior de un solo patrocinador */
export function migrateSponsors(s: GameState) {
  const legacy = s as unknown as {
    club: { sponsor?: { name: string; sector: string; fixed: number; perWin: number; seasonsLeft: number; id: number } };
    sponsorOffers: unknown;
  };
  if (!s.club.sponsors) s.club.sponsors = {};
  const viejo = legacy.club.sponsor;
  if (viejo) {
    s.club.sponsors.camiseta = {
      id: viejo.id, slot: 'camiseta', name: viejo.name, sector: viejo.sector, annual: viejo.fixed,
      perWin: viejo.perWin || undefined, years: viejo.seasonsLeft, yearsLeft: viejo.seasonsLeft,
    };
    delete legacy.club.sponsor;
  }
  if (Array.isArray(legacy.sponsorOffers) || !legacy.sponsorOffers) s.sponsorOffers = {};
  refreshSponsorOffers(s);
}
