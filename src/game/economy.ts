import type { Ledger, Player } from './types';

export const DIVISIONS = 5;
export const TEAMS_PER_DIV = 20;
export const MATCHDAYS = (TEAMS_PER_DIV - 1) * 2;
export const SQUAD_TARGET = 22;
export const SQUAD_MAX = 28;
export const PROMOTE = 3; // ascensos / descensos por división
export const DIRECT_UP = 2; // suben directos; el tercero sale del playoff entre el 3º y el 6º
export const PLAYOFF_FROM = 3;
export const PLAYOFF_TO = 6;

// Nombres neutros para no usar marcas reales de competiciones
export const DIVISION_NAMES = ['Primera División', 'Segunda División', 'Tercera Categoría', 'Cuarta Categoría', 'Liga Comarcal'];

/** Media de calidad de las plantillas en cada división */
export const DIV_LEVEL = [76, 67, 59, 51, 43];
/** Derechos de TV por temporada */
export const DIV_TV = [11_000_000, 3_300_000, 900_000, 240_000, 75_000];
/** Parte de la TV que se cobra fija, jornada a jornada; el resto se reparte por la clasificación final */
export const TV_FIXED = 0.6;
/** Reparto por mérito: del doble de la media (campeón) a nada (último) */
export const tvMeritFactor = (pos: number, n = TEAMS_PER_DIV) => (2 * (n - pos)) / (n - 1);
/** Patrocinio base por temporada */
export const DIV_SPONSOR = [4_000_000, 1_000_000, 250_000, 70_000, 25_000];
/** Afición base de un club medio */
export const DIV_FANS = [28_000, 11_000, 4_000, 2_000, 900];
/** Precio de referencia de la entrada */
export const DIV_PRICE = [45, 25, 14, 10, 8];

export const ESTADIO_JORNADAS_OBRA = 6;
export const NIVEL_MAX = 5;
/** Coste de subir instalaciones al nivel indicado (índice = nivel destino) */
export const COSTE_INSTALACION = [0, 0, 90_000, 450_000, 1_800_000, 6_000_000];

export const emptyLedger = (): Ledger => ({
  taquilla: 0, tv: 0, patrocinio: 0, traspasosIn: 0, traspasosOut: 0, salarios: 0, director: 0, obras: 0,
  comercial: 0, mantenimiento: 0, personal: 0, copa: 0, abonos: 0,
  financiacion: 0, cuotas: 0, intereses: 0, inversores: 0,
  competicion: 0, multas: 0, impuestos: 0, agentes: 0,
});

/** Valor de mercado orientativo de un jugador */
export function playerValue(p: Pick<Player, 'ovr' | 'age' | 'pot'>) {
  let v = 2500 * Math.pow(1.155, p.ovr - 30);
  if (p.age <= 21) v *= 1 + Math.max(0, p.pot - p.ovr) * 0.05;
  else if (p.age <= 24) v *= 1 + Math.max(0, p.pot - p.ovr) * 0.025;
  if (p.age >= 30) v *= 0.75;
  if (p.age >= 32) v *= 0.6;
  if (p.age >= 34) v *= 0.5;
  return roundMoney(v);
}

/** Salario anual que pide un jugador según su nivel */
export function fairSalary(p: Pick<Player, 'ovr' | 'age'>) {
  const s = 900 * Math.pow(1.155, p.ovr - 30);
  return roundMoney(p.age >= 31 ? s * 0.9 : s);
}

export function roundMoney(v: number) {
  if (v < 10_000) return Math.round(v / 100) * 100;
  if (v < 1_000_000) return Math.round(v / 1000) * 1000;
  return Math.round(v / 10_000) * 10_000;
}

export function fmtMoney(v: number) {
  const s = v < 0 ? '-' : '';
  const a = Math.abs(v);
  if (a >= 1_000_000) return `${s}${(a / 1_000_000).toFixed(a >= 10_000_000 ? 1 : 2).replace('.', ',')} M€`;
  if (a >= 1000) return `${s}${Math.round(a / 1000)} mil €`;
  return `${s}${Math.round(a)} €`;
}

export const ledgerIncome = (l: Ledger) => l.taquilla + l.tv + l.patrocinio + l.traspasosIn + (l.comercial ?? 0) + (l.copa ?? 0) + (l.abonos ?? 0) + (l.financiacion ?? 0);
export const ledgerExpense = (l: Ledger) => l.traspasosOut + l.salarios + l.director + l.obras + (l.mantenimiento ?? 0) + (l.personal ?? 0) + (l.cuotas ?? 0) + (l.intereses ?? 0) + (l.inversores ?? 0) + (l.competicion ?? 0) + (l.multas ?? 0) + (l.impuestos ?? 0) + (l.agentes ?? 0);
