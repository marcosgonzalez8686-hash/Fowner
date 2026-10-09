import { DIVISION_NAMES } from './economy';
import { teamById } from './market';
import type { GameState } from './types';
import { countryName, flagOf } from './world';

// Palmarés mundial: campeones y subcampeones de todas las competiciones, temporada a temporada.

export interface Honour {
  season: number;
  /** liga0..liga4 (España por categorías), copa, super, ucl, uel, uecl o liga-XXX (liga extranjera) */
  comp: string;
  teamId: number;
  name: string;
  runnerUp?: { teamId: number; name: string };
}

export interface CompInfo {
  key: string;
  name: string;
  icon: string;
  /** peso en la clasificación de clubes más laureados */
  weight: number;
}

/** Todas las competiciones que tienen palmarés, de más a menos importante */
export function competitions(s: GameState): CompInfo[] {
  const fuera = (s.world?.leagues ?? []).map((l) => ({ key: `liga-${l.country}`, name: `Liga de ${countryName(l.country)}`, icon: flagOf(l.country), weight: 8 }));
  return [
    { key: 'ucl', name: 'Champions League', icon: '⭐', weight: 12 },
    { key: 'liga0', name: DIVISION_NAMES[0], icon: '🥇', weight: 9 },
    ...fuera,
    { key: 'uel', name: 'Europa League', icon: '🟠', weight: 7 },
    { key: 'copa', name: 'Copa', icon: '🏆', weight: 6 },
    { key: 'uecl', name: 'Conference League', icon: '🟢', weight: 4 },
    { key: 'super', name: 'Supercopa', icon: '🏅', weight: 2 },
    ...DIVISION_NAMES.slice(1).map((n, i) => ({ key: `liga${i + 1}`, name: n, icon: '🎖️', weight: Math.max(0.5, 3 - i) })),
  ];
}

export const compInfo = (s: GameState, key: string) => competitions(s).find((c) => c.key === key);

/** Apunta un campeón (y su rival en la final o el segundo) */
export function addHonour(s: GameState, comp: string, teamId: number | undefined, runnerUpId?: number) {
  if (teamId === undefined) return;
  s.honours ??= [];
  // una vez por competición y temporada
  if (s.honours.some((h) => h.season === s.season && h.comp === comp)) return;
  const t = teamById(s, teamId);
  const r = runnerUpId !== undefined ? teamById(s, runnerUpId) : undefined;
  s.honours.push({ season: s.season, comp, teamId, name: t?.name ?? '?', runnerUp: r ? { teamId: r.id, name: r.name } : undefined });
}

export interface ClubHonours {
  teamId: number;
  name: string;
  country?: string;
  total: number;
  score: number;
  /** títulos por competición */
  byComp: Record<string, number>;
}

/** Clasificación de clubes por títulos (ponderando la importancia de cada competición) */
export function honoursRanking(s: GameState): ClubHonours[] {
  const pesos = new Map(competitions(s).map((c) => [c.key, c.weight]));
  const porClub = new Map<number, ClubHonours>();
  for (const h of s.honours ?? []) {
    const t = teamById(s, h.teamId);
    const c = porClub.get(h.teamId) ?? { teamId: h.teamId, name: t?.name ?? h.name, country: t?.country, total: 0, score: 0, byComp: {} };
    c.total++;
    c.score += pesos.get(h.comp) ?? 1;
    c.byComp[h.comp] = (c.byComp[h.comp] ?? 0) + 1;
    porClub.set(h.teamId, c);
  }
  return [...porClub.values()].sort((a, b) => b.score - a.score || b.total - a.total);
}

/** Títulos de un club, agrupados por competición (para su ficha) */
export function clubHonours(s: GameState, teamId: number) {
  const lista = (s.honours ?? []).filter((h) => h.teamId === teamId);
  return competitions(s)
    .map((c) => ({ ...c, seasons: lista.filter((h) => h.comp === c.key).map((h) => h.season) }))
    .filter((c) => c.seasons.length);
}
