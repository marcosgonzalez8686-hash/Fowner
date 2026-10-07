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

export interface LineupPlayer { name: string; pos: Player['pos']; ovr: number }
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
      events.push({ min, side, type: 'gol', player: autor.name, assist: asist?.name });
    }
  };
  goles(info.hg, xiHome, 'home');
  goles(info.ag, xiAway, 'away');
  const tarjetas = (st: SideStats, xi: Player[], side: 'home' | 'away') => {
    const campo = xi.filter((p) => p.pos !== 'POR');
    if (!campo.length) return;
    for (const min of minutes(st.yellows)) events.push({ min, side, type: 'amarilla', player: pick(campo).name });
    if (st.reds) events.push({ min: randInt(30, 89), side, type: 'roja', player: pick(campo).name });
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

  // mejor jugador: el que más ha aportado, con ventaja para el equipo que gana
  const notas = new Map<string, { side: 'home' | 'away'; rating: number }>();
  const base = (xi: Player[], side: 'home' | 'away', dif: number) => {
    for (const p of xi) notas.set(p.name + side, { side, rating: 6 + (p.ovr - 45) / 25 + dif * 0.25 + gauss(0, 0.45) });
  };
  base(xiHome, 'home', info.hg - info.ag);
  base(xiAway, 'away', info.ag - info.hg);
  for (const e of events) {
    const n = notas.get(e.player + e.side);
    if (!n) continue;
    if (e.type === 'gol') n.rating += 1.1;
    if (e.type === 'roja') n.rating -= 1.5;
  }
  for (const e of events) {
    if (e.type === 'gol' && e.assist) {
      const n = notas.get(e.assist + e.side);
      if (n) n.rating += 0.5;
    }
  }
  let mvp = { name: '—', side: 'home' as 'home' | 'away', rating: 0 };
  for (const [k, v] of notas) {
    if (v.rating > mvp.rating) mvp = { name: k.slice(0, -v.side.length), side: v.side, rating: v.rating };
  }
  mvp.rating = Math.round(clamp(mvp.rating, 6, 10) * 10) / 10;

  const linea = (xi: Player[]) => xi.map((p) => ({ name: p.name, pos: p.pos, ovr: p.ovr }));
  const plans = tacticas
    ? { home: { ...tacticas.home, xi: linea(xiHome) }, away: { ...tacticas.away, xi: linea(xiAway) } }
    : undefined;
  return { ...info, events, stats: { home, away }, mvp, plans };
}
