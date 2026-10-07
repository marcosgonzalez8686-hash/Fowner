import type { LineupPlayer, MatchReport } from './report';
import type { GameState, Pos } from './types';

// Estadísticas de la liga: goleadores, asistentes, notas y el once de la jornada de cada división.

export interface StatLine {
  name: string;
  pos: Pos;
  t: number; // equipo con el que las ha conseguido
  apps: number;
  goals: number;
  assists: number;
  rsum: number; // suma de notas
}

export interface BestXIEntry { id: number; name: string; pos: Pos; rating: number; t: number }

export interface LeagueStats {
  season: number;
  players: Record<number, StatLine>;
  /** once ideal de la última jornada, por división */
  bestXI: Record<number, { matchday: number; xi: BestXIEntry[] }>;
}

export const emptyStats = (season: number): LeagueStats => ({ season, players: {}, bestXI: {} });

/** Suma un partido de liga a las estadísticas */
export function harvest(s: GameState, rep: MatchReport) {
  const st = s.leagueStats;
  const lineups: { home: LineupPlayer[]; away: LineupPlayer[] } | undefined = rep.lineups;
  if (!lineups) return;
  for (const side of ['home', 'away'] as const) {
    const t: number = side === 'home' ? rep.home : rep.away;
    const porNombre = new Map<string, number>();
    for (const x of lineups[side]) porNombre.set(x.name, x.id);
    for (const x of lineups[side]) {
      const l = (st.players[x.id] ??= { name: x.name, pos: x.pos, t, apps: 0, goals: 0, assists: 0, rsum: 0 });
      l.t = t;
      l.apps++;
      l.rsum += x.rating;
    }
    for (const e of rep.events) {
      if (e.type !== 'gol' || e.side !== side) continue;
      if (e.pid !== undefined && st.players[e.pid]) st.players[e.pid].goals++;
      const a = e.assist ? porNombre.get(e.assist) : undefined;
      if (a !== undefined && st.players[a]) st.players[a].assists++;
    }
  }
}

const FORMA_XI: Record<Pos, number> = { POR: 1, DEF: 4, MED: 4, DEL: 2 };

/** Once ideal de una jornada a partir de los informes de los partidos de una división */
export function bestXIOf(reps: MatchReport[]): BestXIEntry[] {
  const todos = reps.flatMap((r) => (['home', 'away'] as const).flatMap((side) => (r.lineups?.[side] ?? []).map((x) => ({ ...x, t: side === 'home' ? r.home : r.away }))));
  return (Object.keys(FORMA_XI) as Pos[]).flatMap((pos) =>
    todos
      .filter((x) => x.pos === pos)
      .sort((a, b) => b.rating - a.rating)
      .slice(0, FORMA_XI[pos])
      .map((x) => ({ id: x.id, name: x.name, pos: x.pos, rating: x.rating, t: x.t })),
  );
}

/** Clasificaciones individuales de una división */
export function leaders(s: GameState, division: number) {
  const ids = new Set(s.teams.filter((t) => t.division === division).map((t) => t.id));
  const lineas = Object.entries(s.leagueStats.players)
    .map(([id, l]) => ({ id: Number(id), ...l, avg: l.apps ? l.rsum / l.apps : 0 }))
    .filter((l) => ids.has(l.t));
  const minimo = Math.max(1, Math.floor(s.matchday / 3));
  return {
    goles: [...lineas].filter((l) => l.goals > 0).sort((a, b) => b.goals - a.goals || a.apps - b.apps).slice(0, 10),
    asistencias: [...lineas].filter((l) => l.assists > 0).sort((a, b) => b.assists - a.assists || a.apps - b.apps).slice(0, 10),
    notas: [...lineas].filter((l) => l.apps >= minimo).sort((a, b) => b.avg - a.avg).slice(0, 10),
    minimo,
  };
}
