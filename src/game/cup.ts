import { fmtMoney, roundMoney } from './economy';
import { changeSatisfaction } from './fans';
import { addMessage, myTeam, teamById } from './market';
import { bestEleven, simulate } from './match';
import { changeMorale, injuryName, isInjured, moraleBonus, rollInjuries } from './morale';
import { buildReport } from './report';
import { chance, gauss, shuffle } from './rng';
import { staffMatchBonus } from './staff';
import { expectedAttendance } from './season';
import type { GameState, Player } from './types';

// Copa: eliminatoria a partido único entre 64 equipos, jugada entre semana.
// Juega en casa el equipo de menor categoría; si hay empate, penaltis. La final, en campo neutral.

export interface CupTie {
  a: number;
  b: number;
  home: number | null; // null = campo neutral (final)
  ga?: number;
  gb?: number;
  pens?: string; // resultado de la tanda, p. ej. "4-3"
  winner?: number;
}

export interface Cup {
  season: number;
  rounds: CupTie[][];
  current: number; // ronda que toca jugar
  champion?: number;
}

export const CUP_NAME = 'Copa';
export const ROUND_NAMES = ['Treintaidosavos', 'Dieciseisavos', 'Octavos', 'Cuartos', 'Semifinales', 'Final'];
/** La ronda i se juega después de la jornada de liga indicada */
export const ROUND_AFTER = [3, 8, 13, 19, 26, 33];
/** Premio por superar cada ronda (la última es ganar la Copa) */
export const ROUND_PRIZE = [8_000, 15_000, 30_000, 60_000, 120_000, 400_000];

/** Plazas por división: todos los de arriba y cada vez menos de las categorías inferiores */
const PLAZAS = [20, 20, 10, 7, 7];

/** Equipos que juegan la Copa (el nuestro siempre está) */
function participants(s: GameState) {
  const lista: number[] = [];
  PLAZAS.forEach((n, d) => {
    const deEsa = shuffle(s.teams.filter((t) => t.division === d).map((t) => t.id));
    const mioAqui = deEsa.includes(s.club.teamId);
    const elegidos = mioAqui ? [s.club.teamId, ...deEsa.filter((id) => id !== s.club.teamId)] : deEsa;
    lista.push(...elegidos.slice(0, n));
  });
  return lista;
}

function draw(s: GameState, ids: number[], final: boolean, porCategorias = false): CupTie[] {
  // primera ronda: se emparejan equipos de categoría parecida; después, sorteo libre
  const bombo = porCategorias
    ? shuffle([...ids]).sort((x, y) => teamById(s, y)!.division - teamById(s, x)!.division)
    : shuffle([...ids]);
  const ties: CupTie[] = [];
  for (let i = 0; i < bombo.length; i += 2) {
    const a = bombo[i];
    const b = bombo[i + 1];
    const da = teamById(s, a)!.division;
    const db = teamById(s, b)!.division;
    // en casa el de menor categoría (número de división más alto)
    const home = final ? null : da > db ? a : db > da ? b : a;
    ties.push({ a, b, home });
  }
  return ties;
}

export function newCup(s: GameState): Cup {
  return { season: s.season, rounds: [draw(s, participants(s), false, true)], current: 0 };
}

const lastRound = () => ROUND_NAMES.length - 1;

export function myTie(s: GameState, round = s.cup.current): CupTie | undefined {
  return s.cup.rounds[round]?.find((t) => t.a === s.club.teamId || t.b === s.club.teamId);
}

/** ¿Seguimos vivos en la Copa? */
export function stillIn(s: GameState) {
  const t = myTie(s);
  return Boolean(t) && t!.winner === undefined;
}

/** ¿Toca jugar una ronda de Copa antes de la siguiente jornada de liga? */
export function cupRoundDue(s: GameState) {
  return s.phase === 'temporada' && s.cup.current <= lastRound() && s.matchday >= ROUND_AFTER[s.cup.current] && !s.cup.champion;
}

/** ¿Tiene que jugarla el usuario (seguimos vivos)? */
export const myCupMatchDue = (s: GameState) => cupRoundDue(s) && stillIn(s);

function penalties(fa: number, fb: number): { a: number; b: number } {
  let a = 0;
  let b = 0;
  const pa = 0.75 + (fa - fb) / 200;
  const pb = 0.75 + (fb - fa) / 200;
  for (let i = 0; i < 5; i++) {
    if (chance(pa)) a++;
    if (chance(pb)) b++;
  }
  while (a === b) {
    if (chance(pa)) a++;
    if (chance(pb)) b++;
  }
  return { a, b };
}

/** Juega la ronda de Copa que toca (la nuestra incluida) */
export function playCupRound(s: GameState) {
  if (!cupRoundDue(s)) return;
  const ronda = s.cup.current;
  const porEquipo = new Map<number, Player[]>();
  for (const p of s.players) {
    if (p.teamId === null) continue;
    if (!porEquipo.has(p.teamId)) porEquipo.set(p.teamId, []);
    porEquipo.get(p.teamId)!.push(p);
  }
  const mio = myTeam(s);
  const extra = staffMatchBonus(s) + moraleBonus(s);

  for (const tie of s.cup.rounds[ronda]) {
    const xiA = bestEleven(porEquipo.get(tie.a) ?? []);
    const xiB = bestEleven(porEquipo.get(tie.b) ?? []);
    const casaA = tie.home === tie.a ? 3 : 0;
    const casaB = tie.home === tie.b ? 3 : 0;
    // magia de Copa: a partido único las diferencias se acortan y el pequeño se crece en casa
    const ra = xiA.strength + (tie.a === mio.id ? extra : 0);
    const rb = xiB.strength + (tie.b === mio.id ? extra : 0);
    const media = (ra + rb) / 2;
    const fa = media + (ra - media) * 0.55 + casaA + gauss(0, 3);
    const fb = media + (rb - media) * 0.55 + casaB + gauss(0, 3);
    const { hg: ga, ag: gb } = simulate(fa, fb);
    tie.ga = ga;
    tie.gb = gb;
    if (ga !== gb) tie.winner = ga > gb ? tie.a : tie.b;
    else {
      const p = penalties(fa, fb);
      tie.pens = `${p.a}-${p.b}`;
      tie.winner = p.a > p.b ? tie.a : tie.b;
    }

    if (tie.a === mio.id || tie.b === mio.id) ourMatch(s, tie, ronda, xiA.xi, xiB.xi, fa, fb);
  }

  // siguiente ronda o campeón
  const ganadores = s.cup.rounds[ronda].map((t) => t.winner!);
  if (ronda === lastRound()) {
    s.cup.champion = ganadores[0];
    s.cup.current++;
    const campeon = teamById(s, ganadores[0])!;
    if (campeon.id !== mio.id) {
      addMessage(s, { from: 'liga', title: `🏆 ${campeon.name}, campeón de ${CUP_NAME}`, body: 'Termina la Copa de esta temporada.' });
    }
  } else {
    s.cup.current++;
    s.cup.rounds.push(draw(s, ganadores, s.cup.current === lastRound()));
    const nuestra = myTie(s);
    if (nuestra) {
      const rival = teamById(s, nuestra.a === mio.id ? nuestra.b : nuestra.a)!;
      addMessage(s, {
        from: 'liga',
        title: `Sorteo de ${CUP_NAME}: ${ROUND_NAMES[s.cup.current]}`,
        body:
          `Nos toca el ${rival.name} (${rival.division + 1}ª división)` +
          (nuestra.home === mio.id ? ', en casa.' : nuestra.home === null ? ', en campo neutral.' : ', a domicilio.') +
          ` Se juega tras la jornada ${ROUND_AFTER[s.cup.current]}.`,
      });
    }
  }
}

function ourMatch(s: GameState, tie: CupTie, ronda: number, xiA: Player[], xiB: Player[], fa: number, fb: number) {
  const mio = myTeam(s);
  const somosA = tie.a === mio.id;
  const rival = teamById(s, somosA ? tie.b : tie.a)!;
  const gf = somosA ? tie.ga! : tie.gb!;
  const gc = somosA ? tie.gb! : tie.ga!;
  const ganamos = tie.winner === mio.id;
  const local = tie.home === null ? tie.a : tie.home;

  // informe del partido para el resumen
  const rep = buildReport(
    { season: s.season, matchday: s.matchday, home: local, away: local === tie.a ? tie.b : tie.a, hg: local === tie.a ? tie.ga! : tie.gb!, ag: local === tie.a ? tie.gb! : tie.ga! },
    local === tie.a ? xiA : xiB,
    local === tie.a ? xiB : xiA,
    local === tie.a ? fa : fb,
    local === tie.a ? fb : fa,
  );
  rep.label = `${CUP_NAME} · ${ROUND_NAMES[ronda]}${tie.home === null ? ' (campo neutral)' : ''}`;
  if (tie.pens) rep.pens = local === tie.a ? tie.pens : tie.pens.split('-').reverse().join('-');

  // taquilla si jugamos en casa: la Copa atrae más, sobre todo ante equipos de más categoría
  if (tie.home === mio.id) {
    const atractivo = 1.1 + Math.max(0, mio.division - rival.division) * 0.15;
    const asistencia = Math.round(Math.min(s.club.capacity, expectedAttendance(s) * atractivo));
    const ingreso = asistencia * s.club.ticketPrice;
    s.club.cash += ingreso;
    s.club.ledger.taquilla += ingreso;
    rep.attendance = asistencia;
    rep.revenue = ingreso;
  }

  // lesiones de nuestros titulares
  const nuestros = somosA ? xiA : xiB;
  for (const p of rollInjuries(s, nuestros.filter((x) => !isInjured(x)), mio.id)) {
    rep.events.push({ min: 90, side: local === mio.id ? 'home' : 'away', type: 'lesion', player: `${p.name} (${p.injury} j.)` });
    addMessage(s, { from: 'club', title: `🤕 ${p.name} se lesiona en Copa`, body: `${injuryName(p.injury!)}: ${p.injury} jornada(s) de baja.` });
  }
  s.lastReport = rep;

  const gesta = rival.division < mio.division;
  const marcador = `${gf}-${gc}${tie.pens ? ` (penaltis ${somosA ? tie.pens : tie.pens.split('-').reverse().join('-')})` : ''}`;
  if (ganamos) {
    const premio = ROUND_PRIZE[ronda];
    s.club.cash += premio;
    s.club.ledger.copa += premio;
    changeMorale(s, gesta ? 6 : 3);
    changeSatisfaction(s, (gesta ? 4 : 2) + (ronda === lastRound() ? 12 : 0), `${CUP_NAME}: ${ronda === lastRound() ? '¡campeones!' : `pasamos ${ROUND_NAMES[ronda].toLowerCase()}`}`);
    if (ronda === lastRound()) {
      s.club.trophies.push({ season: s.season, name: CUP_NAME });
      addMessage(s, {
        from: 'liga',
        title: `🏆 ¡CAMPEONES DE ${CUP_NAME.toUpperCase()}!`,
        body: `Final ante el ${rival.name}: ${marcador}. Premio: ${fmtMoney(premio)}. La ciudad está de fiesta.`,
      });
    } else {
      addMessage(s, {
        from: 'liga',
        title: `${CUP_NAME}: pasamos ${ROUND_NAMES[ronda].toLowerCase()}${gesta ? ' ¡GESTA!' : ''}`,
        body: `${rival.name} (${rival.division + 1}ª) ${marcador}. Premio por pasar de ronda: ${fmtMoney(premio)}.`,
      });
    }
  } else {
    changeMorale(s, gesta ? 0 : -3);
    changeSatisfaction(s, gesta ? 0.5 : -1.5, `${CUP_NAME}: eliminados en ${ROUND_NAMES[ronda].toLowerCase()}`);
    addMessage(s, {
      from: 'liga',
      title: `${CUP_NAME}: eliminados en ${ROUND_NAMES[ronda].toLowerCase()}`,
      body: `${rival.name} (${rival.division + 1}ª) ${marcador}.${gesta ? ' Caímos con honor ante un equipo de más categoría.' : ''}`,
    });
  }
}

/** Ingresos de Copa previstos no se incluyen en la previsión: dependen de los resultados */
export const cupPrizeTotal = () => roundMoney(ROUND_PRIZE.reduce((a, b) => a + b, 0));
