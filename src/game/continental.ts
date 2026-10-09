import { addHonour } from './honours';
import { fmtMoney } from './economy';
import { changeSatisfaction } from './fans';
import { recordMatch } from './history';
import { addMessage, myTeam, squadOf, teamById } from './market';
import { bestEleven, chooseStyle, simulate } from './match';
import { changeMorale, injuryName, isInjured, moraleBonus, rollInjuries } from './morale';
import { buildReport } from './report';
import { gauss } from './rng';
import { staffMatchBonus } from './staff';
import { ourPlan, ourTactics } from './coach';
import { cupAttendance } from './tickets';
import { matchKeys } from './insights';
import { tire } from './fatigue';
import { penalties, type CupTie } from './cup';
import type { GameState } from './types';

// Supercopa (campeón de Liga de Primera contra campeón de Copa) y el partido de eliminatoria
// que usan las demás competiciones (europeas y playoff).

export interface Supercopa {
  season: number;
  a: number; // campeón de liga
  b: number; // campeón de copa (o finalista)
  ga?: number;
  gb?: number;
  pens?: string;
  winner?: number;
}

export const SUPER_NAME = 'Supercopa';
export const SUPER_PRIZE = { win: 250_000, lose: 80_000 };
// ---------- Supercopa ----------

export function newSupercopa(s: GameState, ligaCampeon: number, ligaSegundo: number, copaCampeon?: number, copaFinalista?: number) {
  if (copaCampeon === undefined) return;
  // si el mismo club gana las dos, juega el finalista de Copa (o el subcampeón de liga)
  const b = copaCampeon !== ligaCampeon ? copaCampeon : (copaFinalista ?? ligaSegundo);
  s.supercopa = { season: s.season, a: ligaCampeon, b };
  const mio = s.club.teamId;
  if (ligaCampeon === mio || b === mio) {
    const rival = teamById(s, ligaCampeon === mio ? b : ligaCampeon)!;
    addMessage(s, {
      from: 'liga',
      title: `🏅 ¡Jugamos la ${SUPER_NAME}!`,
      body: `Contra el ${rival.name}, en campo neutral, justo antes de la jornada 1. Premio: ${fmtMoney(SUPER_PRIZE.win)} al campeón.`,
    });
  }
}

export const superDue = (s: GameState) => s.phase === 'temporada' && s.supercopa?.season === s.season && s.supercopa.winner === undefined;
export const mySuperDue = (s: GameState) => superDue(s) && (s.supercopa!.a === s.club.teamId || s.supercopa!.b === s.club.teamId);

export function playSupercopa(s: GameState) {
  if (!superDue(s)) return;
  const sc = s.supercopa!;
  const tie: CupTie = { a: sc.a, b: sc.b, home: null };
  playTie(s, tie, SUPER_NAME, 1.3);
  Object.assign(sc, { ga: tie.ga, gb: tie.gb, pens: tie.pens, winner: tie.winner });
  addHonour(s, 'super', sc.winner, sc.winner === sc.a ? sc.b : sc.a);
  const mio = s.club.teamId;
  if (sc.a !== mio && sc.b !== mio) {
    addMessage(s, { from: 'liga', title: `🏅 ${teamById(s, sc.winner!)!.name} gana la ${SUPER_NAME}`, body: `${teamById(s, sc.a)!.name} ${sc.ga}-${sc.gb} ${teamById(s, sc.b)!.name}${sc.pens ? ` (penaltis ${sc.pens})` : ''}.` });
    return;
  }
  const gana = sc.winner === mio;
  const premio = gana ? SUPER_PRIZE.win : SUPER_PRIZE.lose;
  s.club.cash += premio;
  s.club.ledger.copa += premio;
  changeMorale(s, gana ? 5 : -2);
  changeSatisfaction(s, gana ? 6 : -1, gana ? `¡Campeones de la ${SUPER_NAME}!` : `${SUPER_NAME} perdida`);
  if (gana) s.club.trophies.push({ season: s.season, name: SUPER_NAME });
  addMessage(s, {
    from: 'liga',
    title: gana ? `🏅 ¡CAMPEONES DE LA ${SUPER_NAME.toUpperCase()}!` : `${SUPER_NAME}: subcampeones`,
    body: `${marcador(s, tie)}. Premio: ${fmtMoney(premio)}.`,
  });
}

// ---------- partido de eliminatoria ----------

const marcador = (s: GameState, t: CupTie) => {
  const mio = s.club.teamId;
  const nos = t.a === mio;
  const p = t.pens ? ` (penaltis ${nos ? t.pens : t.pens.split('-').reverse().join('-')})` : '';
  return nos ? `${t.ga}-${t.gb}${p}` : `${t.gb}-${t.ga}${p}`;
};

/** Juega una eliminatoria a partido único; si es nuestra, deja el informe para el resumen */
export function playTie(s: GameState, tie: CupTie, label: string, atractivo: number, allowDraw = false) {
  const mio = myTeam(s);
  const extra = staffMatchBonus(s) + moraleBonus(s);
  const plan = (id: number) => (id === mio.id ? ourPlan(s, squadOf(s, id)) : bestEleven(squadOf(s, id)));
  const pa = plan(tie.a);
  const pb = plan(tie.b);
  const ra = pa.strength + (tie.a === mio.id ? extra : 0);
  const rb = pb.strength + (tie.b === mio.id ? extra : 0);
  const fa = ra + (tie.home === tie.a ? 2 : 0) + gauss(0, 2);
  const fb = rb + (tie.home === tie.b ? 2 : 0) + gauss(0, 2);
  const stA = tie.a === mio.id ? ourTactics(s).style : chooseStyle(ra, rb, tie.home === tie.a);
  const stB = tie.b === mio.id ? ourTactics(s).style : chooseStyle(rb, ra, tie.home === tie.b);
  const { hg: ga, ag: gb } = simulate(fa, fb, stA, stB);
  tie.ga = ga;
  tie.gb = gb;
  if (ga !== gb) tie.winner = ga > gb ? tie.a : tie.b;
  else if (allowDraw) tie.winner = undefined; // fase liga: el empate vale un punto
  else {
    const p = penalties(fa, fb);
    tie.pens = `${p.a}-${p.b}`;
    tie.winner = p.a > p.b ? tie.a : tie.b;
  }
  if (tie.a !== mio.id && tie.b !== mio.id) {
    tire(s, [...pa.xi, ...pb.xi]);
    return;
  }

  const somosA = tie.a === mio.id;
  const local = tie.home ?? tie.a;
  const aEsLocal = local === tie.a;
  const rep = buildReport(
    { season: s.season, matchday: s.matchday, home: local, away: aEsLocal ? tie.b : tie.a, hg: aEsLocal ? ga : gb, ag: aEsLocal ? gb : ga },
    aEsLocal ? pa.xi : pb.xi,
    aEsLocal ? pb.xi : pa.xi,
    aEsLocal ? fa : fb,
    aEsLocal ? fb : fa,
    {
      home: { formation: (aEsLocal ? pa : pb).formation, style: aEsLocal ? stA : stB },
      away: { formation: (aEsLocal ? pb : pa).formation, style: aEsLocal ? stB : stA },
    },
  );
  rep.label = `${label}${tie.home === null ? ' (campo neutral)' : ''}`;
  if (tie.pens) rep.pens = aEsLocal ? tie.pens : tie.pens.split('-').reverse().join('-');
  if (tie.home === mio.id) {
    const asistencia = cupAttendance(s, atractivo);
    const ingreso = asistencia * s.club.ticketPrice;
    s.club.cash += ingreso;
    s.club.ledger.taquilla += ingreso;
    rep.attendance = asistencia;
    rep.revenue = ingreso;
  }
  const nuestros = somosA ? pa.xi : pb.xi;
  for (const p of rollInjuries(s, nuestros.filter((x) => !isInjured(x)), mio.id)) {
    rep.events.push({ min: 15 + Math.floor(Math.random() * 74), side: local === mio.id ? 'home' : 'away', type: 'lesion', player: `${p.name} (${p.injury} j.)` });
    addMessage(s, { from: 'club', title: `🤕 ${p.name} se lesiona`, body: `${injuryName(p.injury!)}: ${p.injury} jornada(s) de baja.` });
  }
  rep.keys = matchKeys(s, {
    gf: somosA ? ga : gb,
    gc: somosA ? gb : ga,
    ours: somosA ? ra : rb,
    rival: somosA ? rb : ra,
    oursDay: (somosA ? fa : fb) - (tie.home === mio.id ? 2 : 0),
    rivalDay: (somosA ? fb : fa) - (tie.home !== null && tie.home !== mio.id ? 2 : 0),
    home: tie.home === null ? null : tie.home === mio.id,
    rivalStyle: somosA ? stB : stA,
    xi: nuestros,
  });
  s.lastReport = rep;
  recordMatch(s, rep, nuestros);
  tire(s, [...pa.xi, ...pb.xi]);
}
