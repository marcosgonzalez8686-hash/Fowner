import { chance, clamp, gauss, pick, poisson, randInt } from './rng';
import type { Player } from './types';
import type { Formation, Style } from './match';

// Informe estadístico de nuestro partido, coherente con el resultado simulado

export interface MatchEvent {
  min: number;
  side: 'home' | 'away';
  type: 'gol' | 'amarilla' | 'roja' | 'lesion' | 'ocasion';
  detail?: 'parada' | 'fuera' | 'palo'; // cómo acaba una ocasión
  player: string;
  assist?: string;
  pid?: number; // id del goleador o del amonestado
}

export interface SideStats {
  possession: number;
  shots: number;
  onTarget: number;
  corners: number;
  fouls: number;
  yellows: number;
  reds: number;
}

export interface LineupPlayer { id: number; name: string; pos: Player['pos']; ovr: number; rating: number }
export interface TeamPlan { formation: Formation; style: Style; xi: LineupPlayer[] }

export interface MatchReport {
  season: number;
  matchday: number;
  home: number;
  away: number;
  hg: number;
  ag: number;
  events: MatchEvent[];
  stats: { home: SideStats; away: SideStats };
  mvp: { name: string; side: 'home' | 'away'; rating: number };
  plans?: { home: TeamPlan; away: TeamPlan };
  lineups?: { home: LineupPlayer[]; away: LineupPlayer[] }; // titulares con su nota
  keys?: string[]; // claves del partido (solo los nuestros)
  attendance?: number;
  revenue?: number;
  label?: string; // p. ej. "Copa · Octavos"
  abonados?: number; // abonados que fueron al campo (no pagan entrada)
  pens?: string; // tanda de penaltis (local-visitante)
}

const PESO_GOL: Record<Player['pos'], number> = { POR: 0.02, DEF: 0.8, MED: 2.2, DEL: 5 };
const PESO_ASIST: Record<Player['pos'], number> = { POR: 0.1, DEF: 1, MED: 3, DEL: 2 };

function weighted(xi: Player[], w: Record<Player['pos'], number>, except?: Player) {
  const lista = xi.filter((p) => p !== except);
  const total = lista.reduce((a, p) => a + w[p.pos] * (1 + (p.ovr - 40) / 60), 0);
  let r = Math.random() * total;
  for (const p of lista) {
    r -= w[p.pos] * (1 + (p.ovr - 40) / 60);
    if (r <= 0) return p;
  }
  return lista[lista.length - 1];
}

function minutes(n: number) {
  const usados = new Set<number>();
  const out: number[] = [];
  while (out.length < n) {
    const m = randInt(1, 90);
    if (!usados.has(m)) { usados.add(m); out.push(m); }
  }
  return out;
}

function sideStats(goles: number, fuerza: number, rival: number, posesion: number): SideStats {
  const ventaja = (fuerza - rival) / 10;
  const onTarget = goles + poisson(clamp(2.2 + ventaja, 0.6, 5));
  const shots = onTarget + poisson(clamp(4 + ventaja * 1.5, 1.5, 9));
  const yellows = poisson(1.8);
  return {
    possession: posesion,
    shots,
    onTarget,
    corners: poisson(clamp(4 + ventaja, 1, 9)),
    fouls: 8 + poisson(5),
    yellows,
    reds: chance(0.06) ? 1 : 0,
  };
}

export function buildReport(
  info: { season: number; matchday: number; home: number; away: number; hg: number; ag: number },
  xiHome: Player[],
  xiAway: Player[],
  fuerzaHome: number,
  fuerzaAway: number,
  tacticas?: { home: { formation: Formation; style: Style }; away: { formation: Formation; style: Style } },
): MatchReport {
  const posesion = Math.round(clamp(50 + (fuerzaHome - fuerzaAway) * 1.3 + gauss(0, 4), 28, 72));
  const home = sideStats(info.hg, fuerzaHome, fuerzaAway, posesion);
  const away = sideStats(info.ag, fuerzaAway, fuerzaHome, 100 - posesion);

  const events: MatchEvent[] = [];
  const goles = (n: number, xi: Player[], side: 'home' | 'away') => {
    for (const min of minutes(n)) {
      if (!xi.length) break;
      const autor = weighted(xi, PESO_GOL);
      const asist = chance(0.7) ? weighted(xi, PESO_ASIST, autor) : undefined;
      events.push({ min, side, type: 'gol', player: autor.name, pid: autor.id, assist: asist?.name });
    }
  };
  goles(info.hg, xiHome, 'home');
  goles(info.ag, xiAway, 'away');
  const tarjetas = (st: SideStats, xi: Player[], side: 'home' | 'away') => {
    const campo = xi.filter((p) => p.pos !== 'POR');
    if (!campo.length) return;
    for (const min of minutes(st.yellows)) {
      const p = pick(campo);
      events.push({ min, side, type: 'amarilla', player: p.name, pid: p.id });
    }
    if (st.reds) {
      const p = pick(campo);
      events.push({ min: randInt(30, 89), side, type: 'roja', player: p.name, pid: p.id });
    }
  };
  tarjetas(home, xiHome, 'home');
  tarjetas(away, xiAway, 'away');
  // ocasiones que no acabaron en gol: paradas (tiros a puerta) y tiros fuera o al palo
  const ocasiones = (st: SideStats, goles: number, xi: Player[], side: 'home' | 'away') => {
    if (!xi.length) return;
    const paradas = Math.max(0, st.onTarget - goles);
    const fuera = Math.max(0, st.shots - st.onTarget);
    const total = Math.min(paradas + fuera, 9);
    const mins = minutes(total);
    for (let i = 0; i < total; i++) {
      const detail = i < Math.min(paradas, total) ? 'parada' : chance(0.15) ? 'palo' : 'fuera';
      events.push({ min: mins[i], side, type: 'ocasion', detail, player: weighted(xi, PESO_GOL).name });
    }
  };
  ocasiones(home, info.hg, xiHome, 'home');
  ocasiones(away, info.ag, xiAway, 'away');
  events.sort((a, b) => a.min - b.min);

  // notas de 1 a 10 relativas al nivel del partido: un partido normal ronda el 6
  const todos = [...xiHome, ...xiAway];
  const media = todos.reduce((acc, p) => acc + p.ovr, 0) / Math.max(1, todos.length);
  const notas = new Map<number, number>();
  const porNombre = { home: new Map(xiHome.map((p) => [p.name, p.id])), away: new Map(xiAway.map((p) => [p.name, p.id])) };
  const base = (xi: Player[], gf: number, gc: number) => {
    const res = gf > gc ? 0.4 : gf < gc ? -0.4 : 0;
    for (const p of xi) {
      let n = 6.1 + (p.ovr - media) / 10 + res + clamp(gf - gc, -3, 3) * 0.12 + gauss(0, 0.55);
      // defensas y portero: portería a cero o goles encajados
      if (p.pos === 'POR' || p.pos === 'DEF') n += gc === 0 ? (p.pos === 'POR' ? 0.8 : 0.5) : -0.25 * (gc - 1);
      if (p.pos === 'DEL' && gf === 0) n -= 0.2;
      notas.set(p.id, n);
    }
  };
  base(xiHome, info.hg, info.ag);
  base(xiAway, info.ag, info.hg);
  const suma = (side: 'home' | 'away', nombre: string | undefined, delta: number, pid?: number) => {
    const id = pid ?? (nombre ? porNombre[side].get(nombre) : undefined);
    if (id !== undefined && notas.has(id)) notas.set(id, notas.get(id)! + delta);
  };
  for (const e of events) {
    if (e.type === 'gol') {
      suma(e.side, e.player, 1.0, e.pid);
      suma(e.side, e.assist, 0.5);
    }
    if (e.type === 'ocasion') suma(e.side, e.player, 0.1);
    if (e.type === 'amarilla') suma(e.side, e.player, -0.3);
    if (e.type === 'roja') suma(e.side, e.player, -1.5);
  }
  const fija = (n: number) => Math.round(clamp(n, 3, 10) * 10) / 10;
  const linea = (xi: Player[]): LineupPlayer[] =>
    xi.map((p) => ({ id: p.id, name: p.name, pos: p.pos, ovr: p.ovr, rating: fija(notas.get(p.id) ?? 6) }));
  const lineups = { home: linea(xiHome), away: linea(xiAway) };

  // mejor jugador del partido: la nota más alta
  let mvp = { name: '—', side: 'home' as 'home' | 'away', rating: 0 };
  for (const side of ['home', 'away'] as const) {
    for (const p of lineups[side]) if (p.rating > mvp.rating) mvp = { name: p.name, side, rating: p.rating };
  }

  const plans = tacticas
    ? { home: { ...tacticas.home, xi: lineups.home }, away: { ...tacticas.away, xi: lineups.away } }
    : undefined;
  return { ...info, events, stats: { home, away }, mvp, plans, lineups };
}
