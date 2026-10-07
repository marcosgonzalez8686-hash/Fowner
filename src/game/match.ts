import { poisson, shuffle } from './rng';
import type { Fixture, Player, Pos, Standing } from './types';

/** Formación fija 1-4-4-2 */
export const FORMACION: Record<Pos, number> = { POR: 1, DEF: 4, MED: 4, DEL: 2 };

/** Calendario de ida y vuelta por el método del círculo */
export function roundRobin(teamIds: number[]): Fixture[][] {
  const ids = shuffle([...teamIds]);
  const n = ids.length;
  const ida: Fixture[][] = [];
  for (let r = 0; r < n - 1; r++) {
    const jornada: Fixture[] = [];
    for (let i = 0; i < n / 2; i++) {
      const a = ids[i];
      const b = ids[n - 1 - i];
      // alternar localía para que nadie juegue siempre en casa
      jornada.push(r % 2 === 0 ? { home: a, away: b } : { home: b, away: a });
    }
    ida.push(jornada);
    ids.splice(1, 0, ids.pop()!);
  }
  const vuelta = ida.map((j) => j.map((f) => ({ home: f.away, away: f.home })));
  return [...ida, ...vuelta];
}

/** Once titular: los mejores de cada posición; si faltan, se cubre con otros con penalización */
export function bestEleven(squad: Player[]): { xi: Player[]; strength: number } {
  const disponibles = squad.filter((p) => !p.youth).sort((a, b) => b.ovr - a.ovr);
  const usados = new Set<number>();
  const xi: Player[] = [];
  let total = 0;
  for (const pos of Object.keys(FORMACION) as Pos[]) {
    const deEsa = disponibles.filter((p) => p.pos === pos && !usados.has(p.id)).slice(0, FORMACION[pos]);
    for (const p of deEsa) {
      usados.add(p.id);
      xi.push(p);
      total += p.ovr;
    }
    // huecos: jugador de otra posición con -12, o nadie (-30)
    for (let i = deEsa.length; i < FORMACION[pos]; i++) {
      const suplente = disponibles.find((p) => !usados.has(p.id));
      if (suplente) {
        usados.add(suplente.id);
        xi.push(suplente);
        total += suplente.ovr - (pos === 'POR' ? 20 : 12);
      } else {
        total += 10;
      }
    }
  }
  return { xi, strength: total / 11 };
}

/** Simula un partido a partir de las fuerzas de ambos equipos */
export function simulate(home: number, away: number) {
  const d = (home - away) / 9;
  const lh = 1.45 * Math.exp(d * 0.55) + 0.05;
  const la = 1.15 * Math.exp(-d * 0.55) + 0.05;
  return { hg: Math.min(poisson(lh), 9), ag: Math.min(poisson(la), 9) };
}

export function computeStandings(teamIds: number[], fixtures: Fixture[][]): Standing[] {
  const map = new Map<number, Standing>();
  for (const id of teamIds) map.set(id, { teamId: id, pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, pts: 0 });
  for (const jornada of fixtures) {
    for (const f of jornada) {
      if (f.hg === undefined || f.ag === undefined) continue;
      const h = map.get(f.home)!;
      const a = map.get(f.away)!;
      h.pj++; a.pj++;
      h.gf += f.hg; h.gc += f.ag;
      a.gf += f.ag; a.gc += f.hg;
      if (f.hg > f.ag) { h.g++; a.p++; h.pts += 3; }
      else if (f.hg < f.ag) { a.g++; h.p++; a.pts += 3; }
      else { h.e++; a.e++; h.pts++; a.pts++; }
    }
  }
  return [...map.values()].sort(
    (x, y) => y.pts - x.pts || (y.gf - y.gc) - (x.gf - x.gc) || y.gf - x.gf || x.teamId - y.teamId,
  );
}

/** Racha de los últimos partidos (G/E/P) de un equipo */
export function form(teamId: number, fixtures: Fixture[][], last = 5): ('G' | 'E' | 'P')[] {
  const out: ('G' | 'E' | 'P')[] = [];
  for (const jornada of fixtures) {
    const f = jornada.find((x) => x.home === teamId || x.away === teamId);
    if (!f || f.hg === undefined || f.ag === undefined) continue;
    const mios = f.home === teamId ? f.hg : f.ag;
    const suyos = f.home === teamId ? f.ag : f.hg;
    out.push(mios > suyos ? 'G' : mios < suyos ? 'P' : 'E');
  }
  return out.slice(-last);
}
