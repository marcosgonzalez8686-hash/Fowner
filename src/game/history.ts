import { DIVISION_NAMES, TEAMS_PER_DIV } from './economy';
import { ROUND_NAMES } from './cup';
import { addMessage, teamById } from './market';
import type { MatchReport } from './report';
import type { GameState, Player, Standing } from './types';

// Historia del club: temporadas, récords y leyendas

export interface SeasonRecord {
  season: number;
  division: number;
  position: number;
  points?: number;
  gf?: number;
  gc?: number;
  cup?: string; // "Campeón", "Octavos"...
  topScorer?: { name: string; goals: number };
  promoted?: boolean;
  relegated?: boolean;
  champion?: boolean;
}

export interface MatchMark {
  season: number;
  rival: string;
  gf: number;
  gc: number;
  label: string; // "Jornada 12" o "Copa · Octavos"
}

export interface Records {
  seasons: SeasonRecord[];
  players: Record<number, { name: string; goals: number; apps: number }>; // histórico en el club
  current: Record<number, number>; // goles de esta temporada
  bigWin?: MatchMark;
  bigLoss?: MatchMark;
  attendance?: { season: number; value: number; rival: string };
}

export const emptyRecords = (): Records => ({ seasons: [], players: {}, current: {} });

/** Apunta un partido nuestro: presencias, goles y posibles récords */
export function recordMatch(s: GameState, r: MatchReport, xi: Player[]) {
  const rec = s.club.records;
  const mio = s.club.teamId;
  const lado: 'home' | 'away' = r.home === mio ? 'home' : 'away';
  const rival = teamById(s, lado === 'home' ? r.away : r.home)?.name ?? 'rival';
  for (const p of xi) {
    const x = (rec.players[p.id] ??= { name: p.name, goals: 0, apps: 0 });
    x.apps++;
  }
  for (const e of r.events) {
    if (e.type !== 'gol' || e.side !== lado || e.pid === undefined) continue;
    const x = (rec.players[e.pid] ??= { name: e.player, goals: 0, apps: 0 });
    x.goals++;
    rec.current[e.pid] = (rec.current[e.pid] ?? 0) + 1;
  }
  const gf = lado === 'home' ? r.hg : r.ag;
  const gc = lado === 'home' ? r.ag : r.hg;
  const marca: MatchMark = { season: s.season, rival, gf, gc, label: r.label ?? `Jornada ${r.matchday}` };
  const dif = gf - gc;
  if (dif > 0 && (!rec.bigWin || dif > rec.bigWin.gf - rec.bigWin.gc || (dif === rec.bigWin.gf - rec.bigWin.gc && gf > rec.bigWin.gf))) {
    rec.bigWin = marca;
  }
  if (dif < 0 && (!rec.bigLoss || dif < rec.bigLoss.gf - rec.bigLoss.gc)) rec.bigLoss = marca;
  if (r.attendance && r.home === mio && (!rec.attendance || r.attendance > rec.attendance.value)) {
    rec.attendance = { season: s.season, value: r.attendance, rival };
  }
}

/** Resultado de nuestra Copa en esta temporada */
function cupResult(s: GameState) {
  const mio = s.club.teamId;
  if (s.cup.champion === mio) return 'Campeón';
  for (let i = 0; i < s.cup.rounds.length; i++) {
    const t = s.cup.rounds[i].find((x) => x.a === mio || x.b === mio);
    if (t && t.winner !== undefined && t.winner !== mio) return ROUND_NAMES[i];
  }
  return s.cup.rounds[0]?.some((x) => x.a === mio || x.b === mio) ? '—' : 'No jugó';
}

/** Cierre de temporada: se apunta en la historia y se entregan los títulos */
export function recordSeason(s: GameState, divAntes: number, divDespues: number, pos: number, fila?: Standing) {
  const rec = s.club.records;
  const goleador = Object.entries(rec.current).sort((a, b) => b[1] - a[1])[0];
  const campeon = pos === 1;
  rec.seasons.push({
    season: s.season,
    division: divAntes,
    position: pos,
    points: fila?.pts,
    gf: fila?.gf,
    gc: fila?.gc,
    cup: cupResult(s),
    topScorer: goleador ? { name: rec.players[Number(goleador[0])]?.name ?? '—', goals: goleador[1] } : undefined,
    promoted: divDespues < divAntes,
    relegated: divDespues > divAntes,
    champion: campeon,
  });
  if (campeon) {
    s.club.trophies.push({ season: s.season, name: `Liga · ${DIVISION_NAMES[divAntes]}` });
    addMessage(s, {
      from: 'liga',
      title: `🥇 ¡CAMPEONES DE ${DIVISION_NAMES[divAntes].toUpperCase()}!`,
      body: 'Primer puesto de la liga. El título ya luce en la sala de trofeos.',
    });
  }
  rec.current = {};
}

/** Posición absoluta en la pirámide (1 = líder de Primera) para el gráfico de trayectoria */
export const pyramidRank = (x: { division: number; position: number }) => x.division * TEAMS_PER_DIV + x.position;
