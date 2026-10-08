import { fatiguePenalty } from './match';
import { mySquad } from './market';
import type { LineupPlayer, MatchReport } from './report';
import { chance, clamp, gauss, randInt } from './rng';
import type { GameState, Player } from './types';

// Cambios durante nuestros partidos: el entrenador da minutos al banquillo.
// Salen los más cansados o los que peor lo están haciendo; entran suplentes de la misma posición.

/** Hace los cambios de nuestro equipo en un partido ya jugado. Devuelve los que han entrado. */
export function applySubs(s: GameState, r: MatchReport, xi: Player[], lado: 'home' | 'away'): Player[] {
  const linea = r.lineups?.[lado];
  if (!linea?.length) return [];
  const enXi = new Set(xi.map((p) => p.id));
  const banquillo = mySquad(s).filter((p) => !enXi.has(p.id) && !(p.injury && p.injury > 0) && !(p.suspended && p.suspended > 0));
  if (!banquillo.length) return [];
  const gf = lado === 'home' ? r.hg : r.ag;
  const gc = lado === 'home' ? r.ag : r.hg;
  // con el partido decidido se mueve más el banquillo
  const n = Math.abs(gf - gc) >= 2 ? 5 : chance(0.5) ? 4 : 3;
  const nota = new Map(linea.map((x) => [x.id, x.rating]));
  const expulsados = new Set(r.events.filter((e) => e.type === 'roja' && e.side === lado).map((e) => e.pid));
  const salen = xi
    .filter((p) => p.pos !== 'POR' && !expulsados.has(p.id))
    .sort((a, b) => ((b.fatigue ?? 0) * 0.06 + (6.5 - (nota.get(b.id) ?? 6))) - ((a.fatigue ?? 0) * 0.06 + (6.5 - (nota.get(a.id) ?? 6))));
  const minutos = Array.from({ length: n }, () => randInt(55, 88)).sort((a, b) => a - b);
  const entran: Player[] = [];
  const nuevas: LineupPlayer[] = [];
  const res = gf > gc ? 0.25 : gf < gc ? -0.25 : 0;
  for (const sale of salen) {
    if (entran.length >= n) break;
    const libres = banquillo.filter((p) => !entran.includes(p));
    const rate = (p: Player) => p.ovr - fatiguePenalty(p);
    const entra = libres.filter((p) => p.pos === sale.pos).sort((a, b) => rate(b) - rate(a))[0];
    if (!entra) continue;
    const min = minutos[entran.length];
    entran.push(entra);
    r.events.push({ min, side: lado, type: 'cambio', player: entra.name, out: sale.name, pid: entra.id });
    nuevas.push({ id: entra.id, name: entra.name, pos: entra.pos, ovr: entra.ovr, rating: Math.round(clamp(6 + res + gauss(0, 0.4), 4.5, 8.5) * 10) / 10, sub: min });
    // el que sale descansa algo; el que entra suma minutos
    sale.fatigue = Math.max(0, (sale.fatigue ?? 0) - 5);
    entra.fatigue = Math.min(100, (entra.fatigue ?? 0) + 6);
  }
  r.events.sort((a, b) => a.min - b.min);
  // arrays nuevos: el plan (once inicial) no cambia
  r.lineups = { ...r.lineups!, [lado]: [...linea, ...nuevas] };
  return entran;
}
