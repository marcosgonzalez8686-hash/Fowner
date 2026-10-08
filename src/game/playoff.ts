import { DIVISION_NAMES, DIVISIONS, PLAYOFF_FROM, PLAYOFF_TO } from './economy';
import { changeSatisfaction } from './fans';
import { addMessage, myTeam, teamById } from './market';
import { computeStandings } from './match';
import { changeMorale } from './morale';
import { playTie } from './continental';
import type { CupTie } from './cup';
import type { GameState } from './types';

// Playoff de ascenso: al acabar la liga, del 3º al 6º de cada categoría (menos Primera) se juegan
// la tercera plaza de ascenso. Semifinales 3º-6º y 4º-5º y final, a partido único en casa del mejor clasificado.

export interface Playoff {
  division: number;
  seeds: number[]; // equipos del 3º al 6º, en orden de clasificación
  rounds: CupTie[][];
  current: number;
  winner?: number;
}

export const PLAYOFF_NAME = 'Playoff de ascenso';
export const PLAYOFF_ROUNDS = ['Semifinal', 'Final'];

/** Al terminar la liga se crean los playoffs de todas las categorías */
export function startPlayoffs(s: GameState) {
  s.playoffs = [];
  for (let d = 1; d < DIVISIONS; d++) {
    const ids = s.teams.filter((t) => t.division === d).map((t) => t.id);
    const tabla = computeStandings(ids, s.fixtures[d]);
    const seeds = tabla.slice(PLAYOFF_FROM - 1, PLAYOFF_TO).map((r) => r.teamId);
    s.playoffs.push({
      division: d,
      seeds,
      rounds: [[
        { a: seeds[0], b: seeds[3], home: seeds[0] },
        { a: seeds[1], b: seeds[2], home: seeds[1] },
      ]],
      current: 0,
    });
  }
  const mio = myPlayoffTie(s);
  if (mio) {
    const rival = teamById(s, mio.a === s.club.teamId ? mio.b : mio.a)!;
    addMessage(s, {
      from: 'liga',
      title: `🔥 ¡Jugamos el ${PLAYOFF_NAME}!`,
      body: `Semifinal contra el ${rival.name}, ${mio.home === s.club.teamId ? 'en casa' : 'a domicilio'}. A partido único: si hay empate, penaltis. El ganador de la final sube a ${DIVISION_NAMES[myTeam(s).division - 1]}.`,
    });
  } else finishPlayoffs(s);
}

const delMio = (s: GameState) => s.playoffs?.find((p) => p.division === myTeam(s).division);

/** Nuestra eliminatoria de la ronda actual (si seguimos vivos) */
export function myPlayoffTie(s: GameState) {
  const p = delMio(s);
  if (!p || p.winner !== undefined) return undefined;
  return p.rounds[p.current]?.find((t) => (t.a === s.club.teamId || t.b === s.club.teamId) && t.winner === undefined);
}

export const myPlayoffDue = (s: GameState) => s.phase === 'fin' && Boolean(myPlayoffTie(s));
export const playoffRoundName = (s: GameState) => PLAYOFF_ROUNDS[delMio(s)?.current ?? 0];

/** Juega la ronda actual de todos los playoffs */
export function playPlayoffRound(s: GameState) {
  const mio = s.club.teamId;
  for (const p of s.playoffs ?? []) {
    if (p.winner !== undefined) continue;
    const ronda = p.current;
    for (const tie of p.rounds[ronda]) {
      playTie(s, tie, `${PLAYOFF_NAME} · ${PLAYOFF_ROUNDS[ronda]}`, ronda === 1 ? 1.8 : 1.5);
      if (tie.a !== mio && tie.b !== mio) continue;
      const rival = teamById(s, tie.a === mio ? tie.b : tie.a)!;
      const res = resultado(s, tie);
      if (tie.winner !== mio) {
        changeMorale(s, -3);
        changeSatisfaction(s, -3, `${PLAYOFF_NAME}: eliminados`);
        addMessage(s, { from: 'liga', title: `💔 Fuera del ${PLAYOFF_NAME}`, body: `${res} ante el ${rival.name} en la ${PLAYOFF_ROUNDS[ronda].toLowerCase()}. Seguimos en ${DIVISION_NAMES[p.division]}.` });
      } else if (ronda === 0) {
        changeMorale(s, 4);
        addMessage(s, { from: 'liga', title: `🔥 ¡A la final del ${PLAYOFF_NAME}!`, body: `${res} ante el ${rival.name}. Un partido nos separa del ascenso.` });
      } else {
        changeMorale(s, 6);
        addMessage(s, { from: 'liga', title: `🎉 ¡ASCENSO POR EL PLAYOFF!`, body: `${res} ante el ${rival.name} en la final. ¡Subimos a ${DIVISION_NAMES[p.division - 1]}! Cierra la temporada para celebrarlo.` });
      }
    }
    cierraRonda(s, p);
  }
  // si ya no estamos en juego, el resto se resuelve sin esperar
  if (!myPlayoffTie(s)) finishPlayoffs(s);
}

/** Termina todos los playoffs pendientes */
export function finishPlayoffs(s: GameState) {
  let vueltas = 0;
  while ((s.playoffs ?? []).some((p) => p.winner === undefined) && vueltas++ < 3) {
    if (myPlayoffTie(s)) return; // los nuestros se juegan desde Inicio
    const report = s.lastReport;
    for (const p of s.playoffs!) {
      if (p.winner !== undefined) continue;
      const ronda = p.current;
      for (const tie of p.rounds[ronda]) playTie(s, tie, PLAYOFF_NAME, 1);
      cierraRonda(s, p);
    }
    s.lastReport = report;
  }
}

/** Cierra la ronda: de semifinales a la final, o de la final al ascenso */
function cierraRonda(s: GameState, p: Playoff) {
  const ganadores = p.rounds[p.current].map((t) => t.winner!);
  p.current++;
  if (p.current === 1) {
    // la final, en casa del mejor clasificado de los dos
    const [x, y] = ganadores.sort((a, b) => p.seeds.indexOf(a) - p.seeds.indexOf(b));
    p.rounds.push([{ a: x, b: y, home: x }]);
    return;
  }
  p.winner = ganadores[0];
  if (p.division === myTeam(s).division && p.winner !== s.club.teamId) {
    addMessage(s, { from: 'liga', title: `${teamById(s, p.winner)!.name} gana el ${PLAYOFF_NAME}`, body: `Acompaña a los dos primeros a ${DIVISION_NAMES[p.division - 1]}.` });
  }
}

/** Equipo que sube por el playoff en una categoría */
export const playoffWinner = (s: GameState, division: number) => s.playoffs?.find((p) => p.division === division)?.winner;

const resultado = (s: GameState, t: CupTie) => {
  const nos = t.a === s.club.teamId;
  const p = t.pens ? ` (penaltis ${nos ? t.pens : t.pens.split('-').reverse().join('-')})` : '';
  return nos ? `${t.ga}-${t.gb}${p}` : `${t.gb}-${t.ga}${p}`;
};
