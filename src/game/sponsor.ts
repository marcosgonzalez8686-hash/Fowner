import { DIV_FANS, DIV_SPONSOR, fmtMoney, roundMoney } from './economy';
import { sponsorBonus } from './land';
import { addMessage, myTeam } from './market';
import { clamp, pick, rand, shuffle } from './rng';
import { marketingSponsorBonus } from './staff';
import type { GameState } from './types';

// Patrocinio principal: cada pretemporada llegan tres ofertas con condiciones distintas

export type SponsorKind = 'fijo' | 'variable' | 'largo';

export interface SponsorDeal {
  id: number;
  name: string;
  sector: string;
  kind: SponsorKind;
  fixed: number; // € por temporada, repartidos por jornada
  perWin: number; // prima por victoria
  promotionBonus: number; // prima si se asciende
  seasons: number; // duración del contrato
}

export interface ActiveSponsor extends SponsorDeal {
  seasonsLeft: number;
}

const EMPRESAS = [
  ['Conservas Ribera', 'Alimentación'], ['Talleres Montañés', 'Automoción'], ['Panadería La Espiga', 'Alimentación'],
  ['Construcciones Valdés', 'Construcción'], ['Bodegas Altozano', 'Vinos'], ['Seguros Atalaya', 'Seguros'],
  ['Transportes Galán', 'Logística'], ['Óptica Mirasol', 'Comercio'], ['Muebles Robledo', 'Comercio'],
  ['Energías del Norte', 'Energía'], ['Clínica Dental Sonrisa', 'Salud'], ['Gestoría Pardo', 'Servicios'],
  ['Cervezas Lúpulo Bravo', 'Bebidas'], ['Telecom Rápida', 'Telecomunicaciones'], ['Hotel Mirador', 'Turismo'],
  ['Banca Comarcal', 'Banca'], ['Lácteos Pradoverde', 'Alimentación'], ['Cafés Tostadero', 'Bebidas'],
];

export const KIND_INFO: Record<SponsorKind, { label: string; help: string }> = {
  fijo: { label: 'Fijo', help: 'Una cantidad segura, ganes o pierdas.' },
  variable: { label: 'Por objetivos', help: 'Menos fijo, pero cobras una prima por cada victoria y por ascender.' },
  largo: { label: 'Largo plazo', help: 'Algo menos al año, pero garantizado durante 3 temporadas.' },
};

/** Valor base del patrocinio según categoría, afición e instalaciones */
export function sponsorBase(s: GameState) {
  const t = myTeam(s);
  return DIV_SPONSOR[t.division] * clamp(0.6 + 0.4 * (t.fans / DIV_FANS[t.division]), 0.5, 2) * sponsorBonus(s) * marketingSponsorBonus(s);
}

export function makeOffers(s: GameState): SponsorDeal[] {
  const base = sponsorBase(s);
  const empresas = shuffle([...EMPRESAS]).slice(0, 3);
  const tipos: SponsorKind[] = ['fijo', 'variable', 'largo'];
  return tipos.map((kind, i) => {
    const [name, sector] = empresas[i];
    const r = rand(0.92, 1.08);
    return {
      id: s.nextId++,
      name,
      sector,
      kind,
      fixed: roundMoney(base * r * (kind === 'fijo' ? 1 : kind === 'variable' ? 0.55 : 0.88)),
      perWin: kind === 'variable' ? roundMoney((base * r * 0.9) / 19) : 0,
      promotionBonus: kind === 'variable' ? roundMoney(base * r * 0.6) : 0,
      seasons: kind === 'largo' ? 3 : 1,
    };
  });
}

/** Lo que ingresa el patrocinio fijo esta temporada */
export function sponsorFixed(s: GameState) {
  return s.club.sponsor ? s.club.sponsor.fixed : roundMoney(sponsorBase(s));
}

export function chooseSponsor(s: GameState, id: number): string | undefined {
  const o = s.sponsorOffers.find((x) => x.id === id);
  if (!o) return 'Esa oferta ya no está disponible.';
  s.club.sponsor = { ...o, seasonsLeft: o.seasons };
  s.sponsorOffers = [];
  addMessage(s, {
    from: 'club',
    title: `Firmado: ${o.name} patrocina al club`,
    body:
      `${KIND_INFO[o.kind].label}: ${fmtMoney(o.fixed)} por temporada` +
      (o.perWin ? `, ${fmtMoney(o.perWin)} por victoria y ${fmtMoney(o.promotionBonus)} si ascendemos` : '') +
      (o.seasons > 1 ? `, durante ${o.seasons} temporadas` : '') +
      '.',
  });
}

/** Al empezar una pretemporada: sigue el contrato largo o llegan ofertas nuevas */
export function sponsorNewSeason(s: GameState) {
  const sp = s.club.sponsor;
  if (sp && sp.seasonsLeft > 1) {
    sp.seasonsLeft--;
    addMessage(s, { from: 'club', title: `${sp.name} sigue con nosotros`, body: `Quedan ${sp.seasonsLeft} temporada(s) de contrato.` });
    return;
  }
  s.club.sponsor = undefined;
  s.sponsorOffers = makeOffers(s);
  addMessage(s, {
    from: 'club',
    title: 'Tres empresas quieren patrocinarnos',
    body: 'Elige una en Inicio antes de empezar la temporada.',
  });
}

export const randomSponsorName = () => pick(EMPRESAS)[0];
