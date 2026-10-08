import { DIV_LEVEL, fmtMoney } from './economy';
import { changeSatisfaction } from './fans';
import { makePlayer, PLANTILLA } from './generate';
import { recordMatch } from './history';
import { addMessage, myTeam, squadOf, teamById } from './market';
import { bestEleven, chooseStyle, simulate } from './match';
import { changeMorale, injuryName, isInjured, moraleBonus, rollInjuries } from './morale';
import { buildReport } from './report';
import { gauss, pick, rand, shuffle } from './rng';
import { staffMatchBonus } from './staff';
import { ourPlan, ourTactics } from './coach';
import { cupAttendance } from './tickets';
import { matchKeys } from './insights';
import { tire } from './fatigue';
import { penalties, type CupTie } from './cup';
import type { GameState, Player, Team } from './types';

// Supercopa (campeón de Liga de Primera contra campeón de Copa) y Copa de Campeones
// (los 4 primeros de Primera contra 12 clubes extranjeros), a partido único.

export interface Supercopa {
  season: number;
  a: number; // campeón de liga
  b: number; // campeón de copa (o finalista)
  ga?: number;
  gb?: number;
  pens?: string;
  winner?: number;
}

export interface Continental {
  season: number;
  foreign: Team[];
  squads: Record<number, Player[]>;
  rounds: CupTie[][];
  current: number;
  champion?: number;
}

export const SUPER_NAME = 'Supercopa';
export const SUPER_PRIZE = { win: 250_000, lose: 80_000 };
export const CONT_NAME = 'Copa de Campeones';
export const CONT_ROUNDS = ['Octavos', 'Cuartos', 'Semifinales', 'Final'];
/** La ronda i se juega tras la jornada de liga indicada (sin pisar a la Copa) */
export const CONT_AFTER = [10, 16, 23, 30];
export const CONT_PRIZE = [500_000, 1_000_000, 2_000_000, 5_000_000];
export const CONT_ENTRY = 1_000_000;

const CLUBES: Record<string, string[]> = {
  Italia: ['AC Vesuvia', 'Real Torrese', 'Unione Lagunare', 'Sporting Montefiore'],
  Inglaterra: ['Ashford Rovers', 'Kingsbridge United', 'Northvale Athletic', 'Westmoor City'],
  Alemania: ['FC Rheinfeld', 'Borussia Altdorf', 'SV Edelburg', 'Eintracht Hohenwald'],
  Francia: ['Olympique Valmont', 'AS Saint-Lucien', 'Racing Belleville', 'FC Montclair'],
  Portugal: ['Sporting Ribamar', 'FC Alvorada', 'Vitória de Serrana', 'Académica do Douro'],
  'Países Bajos': ['SC Lindehoven', 'Willem Westerdam', 'FC Zuidburg', 'VV Delfhaven'],
};
export const FLAG: Record<string, string> = { Italia: '🇮🇹', Inglaterra: '🇬🇧', Alemania: '🇩🇪', Francia: '🇫🇷', Portugal: '🇵🇹', 'Países Bajos': '🇳🇱' };

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

// ---------- Copa de Campeones ----------

/** Se crea en verano si hemos quedado entre los 4 primeros de Primera */
export function newContinental(s: GameState, top4: number[]) {
  if (!top4.includes(s.club.teamId)) {
    s.continental = undefined;
    return;
  }
  const foreign: Team[] = [];
  const squads: Record<number, Player[]> = {};
  const paises = Object.keys(CLUBES);
  const nombres = shuffle(paises.flatMap((c) => CLUBES[c].map((n) => ({ c, n })))).slice(0, 12);
  for (const { c, n } of nombres) {
    const id = s.nextId++;
    const corto = n.replace(/^(AC|FC|SC|AS|SV|VV|Real|Sporting|Unione|Borussia|Eintracht|Olympique|Racing|Willem|Vitória de|Académica do)\s+/, '').slice(0, 3).toUpperCase();
    foreign.push({ id, name: n, short: corto, division: 0, fans: 40_000, country: c });
    // nivel de un grande europeo: como los mejores de Primera
    const nivel = DIV_LEVEL[0] + rand(-3, 5);
    squads[id] = PLANTILLA.map((pos) => makePlayer(s, nivel, { pos, teamId: id, contract: 3 }));
  }
  const ids = shuffle([...top4, ...foreign.map((t) => t.id)]);
  s.continental = { season: s.season, foreign, squads, rounds: [pairs(ids, false)], current: 0 };
  s.club.cash += CONT_ENTRY;
  s.club.ledger.copa += CONT_ENTRY;
  const nuestra = myContTie(s)!;
  const rival = teamById(s, nuestra.a === s.club.teamId ? nuestra.b : nuestra.a)!;
  addMessage(s, {
    from: 'liga',
    title: `🌍 ¡Jugamos la ${CONT_NAME}!`,
    body:
      `Por quedar entre los 4 primeros de Primera. Solo por participar: ${fmtMoney(CONT_ENTRY)}.\n` +
      `Octavos: ${rival.name} (${FLAG[rival.country!] ?? ''} ${rival.country}), tras la jornada ${CONT_AFTER[0]}.`,
  });
}

function pairs(ids: number[], final: boolean): CupTie[] {
  const out: CupTie[] = [];
  for (let i = 0; i < ids.length; i += 2) out.push({ a: ids[i], b: ids[i + 1], home: final ? null : pick([ids[i], ids[i + 1]]) });
  return out;
}

export const myContTie = (s: GameState) => s.continental?.rounds[s.continental.current]?.find((t) => t.a === s.club.teamId || t.b === s.club.teamId);

export const contDue = (s: GameState) =>
  s.phase === 'temporada' && s.continental?.season === s.season && s.continental.champion === undefined && s.matchday >= CONT_AFTER[s.continental.current];
export const myContDue = (s: GameState) => contDue(s) && myContTie(s)?.winner === undefined && Boolean(myContTie(s));

export function playContinentalRound(s: GameState) {
  if (!contDue(s)) return;
  const c = s.continental!;
  const ronda = c.current;
  const mio = s.club.teamId;
  for (const tie of c.rounds[ronda]) {
    playTie(s, tie, `${CONT_NAME} · ${CONT_ROUNDS[ronda]}`, 1.6);
    if (tie.a !== mio && tie.b !== mio) continue;
    const rival = teamById(s, tie.a === mio ? tie.b : tie.a)!;
    if (tie.winner === mio) {
      const premio = CONT_PRIZE[ronda];
      s.club.cash += premio;
      s.club.ledger.copa += premio;
      changeMorale(s, 5);
      const final = ronda === CONT_ROUNDS.length - 1;
      changeSatisfaction(s, final ? 20 : 4, final ? `¡Campeones de la ${CONT_NAME}!` : `${CONT_NAME}: pasamos ${CONT_ROUNDS[ronda].toLowerCase()}`);
      if (final) s.club.trophies.push({ season: s.season, name: CONT_NAME });
      addMessage(s, {
        from: 'liga',
        title: final ? `🌍 ¡¡CAMPEONES DE LA ${CONT_NAME.toUpperCase()}!!` : `🌍 ${CONT_NAME}: pasamos ${CONT_ROUNDS[ronda].toLowerCase()}`,
        body: `${marcador(s, tie)} ante el ${rival.name}. Premio: ${fmtMoney(premio)}.${final ? ' El club entra en la historia del fútbol europeo.' : ''}`,
      });
    } else {
      changeMorale(s, -2);
      changeSatisfaction(s, -1, `${CONT_NAME}: eliminados`);
      addMessage(s, { from: 'liga', title: `🌍 ${CONT_NAME}: eliminados en ${CONT_ROUNDS[ronda].toLowerCase()}`, body: `${marcador(s, tie)} ante el ${rival.name}.` });
    }
  }
  const ganadores = c.rounds[ronda].map((t) => t.winner!);
  c.current++;
  if (ronda === CONT_ROUNDS.length - 1) {
    c.champion = ganadores[0];
    if (c.champion !== mio) addMessage(s, { from: 'liga', title: `🌍 ${teamById(s, c.champion)!.name}, campeón de la ${CONT_NAME}`, body: 'Termina la competición europea.' });
  } else {
    c.rounds.push(pairs(shuffle(ganadores), c.current === CONT_ROUNDS.length - 1));
  }
}

// ---------- partido de eliminatoria ----------

const marcador = (s: GameState, t: CupTie) => {
  const mio = s.club.teamId;
  const nos = t.a === mio;
  const p = t.pens ? ` (penaltis ${nos ? t.pens : t.pens.split('-').reverse().join('-')})` : '';
  return nos ? `${t.ga}-${t.gb}${p}` : `${t.gb}-${t.ga}${p}`;
};

/** Juega una eliminatoria a partido único; si es nuestra, deja el informe para el resumen */
function playTie(s: GameState, tie: CupTie, label: string, atractivo: number) {
  const mio = myTeam(s);
  const extra = staffMatchBonus(s) + moraleBonus(s);
  const plan = (id: number) => (id === mio.id ? ourPlan(s, squadOf(s, id)) : bestEleven(squadOf(s, id)));
  const pa = plan(tie.a);
  const pb = plan(tie.b);
  tire(s, [...pa.xi, ...pb.xi]);
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
  else {
    const p = penalties(fa, fb);
    tie.pens = `${p.a}-${p.b}`;
    tie.winner = p.a > p.b ? tie.a : tie.b;
  }
  if (tie.a !== mio.id && tie.b !== mio.id) return;

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
}
