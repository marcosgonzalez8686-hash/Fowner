import { DIVISION_NAMES, TEAMS_PER_DIV } from './economy';
import { ROUND_NAMES } from './cup';
import { addMessage, teamById } from './market';
import type { MatchReport } from './report';
import type { GameState, Player, Standing } from './types';
import { changeMorale } from './morale';
import { chance } from './rng';

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
  bestPlayer?: { name: string; rating: number; apps: number };
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
  retired?: { name: string; pos: string; season: number; age: number; apps: number; goals: number; tribute: boolean }[]; // retirados en el club
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
  rateOurPlayers(s, r, lado);
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

/** Nota media de la temporada de un jugador (o null si no ha jugado) */
export const seasonAverage = (p: Player) => (p.season && p.season.apps ? Math.round((p.season.ratingSum / p.season.apps) * 10) / 10 : null);

/**
 * Notas de nuestros titulares: estadísticas de la temporada, últimas 5 notas y consecuencias
 * (los jóvenes en racha progresan; un partido colectivo muy bueno o muy malo toca la moral).
 */
function rateOurPlayers(s: GameState, r: MatchReport, lado: 'home' | 'away') {
  const linea = r.lineups?.[lado];
  if (!linea?.length) return;
  const porNombre = new Map(linea.map((x) => [x.name, x.id]));
  for (const x of linea) {
    const p = s.players.find((y) => y.id === x.id);
    if (!p) continue;
    p.season ??= { apps: 0, goals: 0, assists: 0, ratingSum: 0 };
    p.season.apps++;
    p.season.ratingSum += x.rating;
    p.form = [...(p.form ?? []), x.rating].slice(-5);
  }
  for (const e of r.events) {
    if (e.type !== 'gol' || e.side !== lado) continue;
    const goleador = s.players.find((y) => y.id === e.pid);
    if (goleador?.season) goleador.season.goals++;
    const idAsist = e.assist ? porNombre.get(e.assist) : undefined;
    const asist = idAsist !== undefined ? s.players.find((y) => y.id === idAsist) : undefined;
    if (asist?.season) asist.season.assists++;
  }
  // jóvenes en racha: una media de 7,3 o más en los tres últimos partidos puede hacerles crecer
  for (const x of linea) {
    const p = s.players.find((y) => y.id === x.id);
    if (!p || p.age > 23 || !p.form || p.form.length < 3) continue;
    const ultimas = p.form.slice(-3);
    if (ultimas.reduce((a, n) => a + n, 0) / 3 >= 7.3 && p.ovr < p.pot + 2 && chance(0.35)) {
      p.ovr++;
      p.pot = Math.max(p.pot, p.ovr);
      p.form = [];
      addMessage(s, { from: 'club', title: `📈 ${p.name} está en racha`, body: `Tres grandes partidos seguidos: su media sube a ${p.ovr}.` });
    }
  }
  // partido colectivo
  const mediaEquipo = linea.reduce((a, x) => a + x.rating, 0) / linea.length;
  if (mediaEquipo >= 7.2) changeMorale(s, 2);
  else if (mediaEquipo <= 5.3) changeMorale(s, -2);
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
  // mejor jugador de la temporada: mejor nota media con al menos 10 partidos
  const candidatos = s.players
    .filter((p) => p.teamId === s.club.teamId && (p.season?.apps ?? 0) >= 10)
    .map((p) => ({ name: p.name, rating: seasonAverage(p)!, apps: p.season!.apps }))
    .sort((a, b) => b.rating - a.rating);
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
    bestPlayer: candidatos[0],
  });
  // las estadísticas de temporada vuelven a cero
  for (const p of s.players) p.season = undefined;
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
