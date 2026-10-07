import { poisson, shuffle } from './rng';
import type { Fixture, Player, Pos, Standing } from './types';

/** Formaciones que puede elegir un entrenador (portero aparte) */
export const FORMATIONS = {
  '4-4-2': { POR: 1, DEF: 4, MED: 4, DEL: 2 },
  '4-3-3': { POR: 1, DEF: 4, MED: 3, DEL: 3 },
  '4-5-1': { POR: 1, DEF: 4, MED: 5, DEL: 1 },
  '5-3-2': { POR: 1, DEF: 5, MED: 3, DEL: 2 },
  '3-5-2': { POR: 1, DEF: 3, MED: 5, DEL: 2 },
} as const satisfies Record<string, Record<Pos, number>>;
export type Formation = keyof typeof FORMATIONS;

/** Formación de referencia (la usa el director deportivo para valorar la plantilla) */
export const FORMACION: Record<Pos, number> = FORMATIONS['4-4-2'];

/** Estilo de juego: cuánto ataca un equipo y cuánto se expone atrás */
export type Style = 'ofensivo' | 'equilibrado' | 'defensivo' | 'contraataque';
export const STYLES: Record<Style, { label: string; icon: string; att: number; conc: number }> = {
  ofensivo: { label: 'Ofensivo', icon: '⚔️', att: 1.15, conc: 1.12 },
  equilibrado: { label: 'Equilibrado', icon: '⚖️', att: 1, conc: 1 },
  defensivo: { label: 'Defensivo', icon: '🛡️', att: 0.82, conc: 0.85 },
  contraataque: { label: 'Al contraataque', icon: '⚡', att: 0.93, conc: 0.88 },
};

/** El entrenador elige estilo según lo fuerte que se ve frente al rival */
export function chooseStyle(own: number, rival: number, enCasa: boolean): Style {
  const d = own - rival + (enCasa ? 1.5 : -1.5);
  if (d > 3) return 'ofensivo';
  if (d < -5) return enCasa ? 'defensivo' : 'contraataque';
  if (d < -2) return 'contraataque';
  return 'equilibrado';
}

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

/** Once titular en una formación: los mejores de cada posición; si faltan, se cubre con otros con penalización */
export function elevenFor(squad: Player[], formation: Formation, rate: (p: Player) => number = (p) => p.ovr): { xi: Player[]; strength: number } {
  const forma = FORMATIONS[formation];
  // los juveniles sin decidir y los lesionados no juegan
  const disponibles = squad.filter((p) => !p.youth && !(p.injury && p.injury > 0)).sort((a, b) => rate(b) - rate(a));
  const usados = new Set<number>();
  const xi: Player[] = [];
  let total = 0;
  for (const pos of Object.keys(forma) as Pos[]) {
    const deEsa = disponibles.filter((p) => p.pos === pos && !usados.has(p.id)).slice(0, forma[pos]);
    for (const p of deEsa) {
      usados.add(p.id);
      xi.push(p);
      total += rate(p);
    }
    // huecos: jugador de otra posición con -12, o nadie (-30)
    for (let i = deEsa.length; i < forma[pos]; i++) {
      const suplente = disponibles.find((p) => !usados.has(p.id));
      if (suplente) {
        usados.add(suplente.id);
        xi.push(suplente);
        total += rate(suplente) - (pos === 'POR' ? 20 : 12);
      } else {
        total += 10;
      }
    }
  }
  return { xi, strength: total / 11 };
}

/** El entrenador elige la formación con la que mejor rinde su plantilla */
export function bestEleven(squad: Player[]): { xi: Player[]; strength: number; formation: Formation } {
  let mejor: { xi: Player[]; strength: number; formation: Formation } | null = null;
  for (const f of Object.keys(FORMATIONS) as Formation[]) {
    const r = elevenFor(squad, f);
    // pequeña preferencia por el 4-4-2 clásico en caso de empate
    if (!mejor || r.strength > mejor.strength + (f === '4-4-2' ? -0.05 : 0.05)) mejor = { ...r, formation: f };
  }
  return mejor!;
}

/** Simula un partido a partir de las fuerzas de ambos equipos */
export function simulate(home: number, away: number, sh: Style = 'equilibrado', sa: Style = 'equilibrado') {
  const d = (home - away) / 9;
  const lh = (1.45 * Math.exp(d * 0.55) + 0.05) * STYLES[sh].att * STYLES[sa].conc;
  const la = (1.15 * Math.exp(-d * 0.55) + 0.05) * STYLES[sa].att * STYLES[sh].conc;
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
