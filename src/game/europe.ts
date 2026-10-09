import { addHonour } from './honours';
import { fmtMoney } from './economy';
import { changeSatisfaction } from './fans';
import { addMessage, squadOf, teamById } from './market';
import { bestEleven, roundRobin } from './match';
import { changeMorale } from './morale';
import { playTie } from './continental';
import { shuffle } from './rng';
import { penalties, type CupTie } from './cup';
import type { GameState } from './types';
import { COUNTRIES, FOREIGN, flagOf } from './world';

// Competiciones europeas: Champions League, Europa League y Conference League.
// 16 clubes cada una: fase liga de 4 jornadas (cada uno contra 4 rivales distintos)
// y los 8 primeros pasan a cuartos y semifinales (ida y vuelta) y a la final (partido único en campo neutral).

export type EuroKey = 'ucl' | 'uel' | 'uecl';
export const EURO_KEYS: EuroKey[] = ['ucl', 'uel', 'uecl'];

export const EURO: Record<EuroKey, { name: string; icon: string; entry: number; win: number; draw: number; ko: number[] }> = {
  ucl: { name: 'Champions League', icon: '⭐', entry: 3_000_000, win: 600_000, draw: 200_000, ko: [2_500_000, 4_000_000, 7_000_000] },
  uel: { name: 'Europa League', icon: '🟠', entry: 1_000_000, win: 250_000, draw: 80_000, ko: [800_000, 1_400_000, 2_500_000] },
  uecl: { name: 'Conference League', icon: '🟢', entry: 500_000, win: 120_000, draw: 40_000, ko: [400_000, 700_000, 1_200_000] },
};

/** Fechas: tras qué jornada de liga se juega cada fase (sin pisar la Copa) */
export const EURO_AFTER = [4, 7, 11, 15, 20, 22, 27, 29, 35];
export const EURO_STAGES = ['Jornada 1', 'Jornada 2', 'Jornada 3', 'Jornada 4', 'Cuartos (ida)', 'Cuartos (vuelta)', 'Semifinales (ida)', 'Semifinales (vuelta)', 'Final'];
const LIGA = 4; // jornadas de la fase liga

/** Plazas de cada país: [Champions, Europa League, Conference] */
const PLAZAS: Record<string, [number, number, number]> = {
  ESP: [4, 2, 2], ENG: [3, 2, 2], ITA: [3, 2, 2], GER: [3, 2, 2], FRA: [2, 2, 2], POR: [1, 3, 2], NED: [0, 3, 4],
};

export interface EuroComp {
  key: EuroKey;
  teams: number[];
  league: CupTie[][]; // 4 jornadas
  ko: CupTie[][]; // cuartos (ida, vuelta), semis (ida, vuelta) y final
  stage: number; // 0-3 fase liga, 4-5 cuartos, 6-7 semis, 8 final, 9 terminada
  champion?: number;
}

export interface Europe {
  season: number;
  comps: EuroComp[];
  legs?: boolean; // eliminatorias a ida y vuelta (las partidas de antes eran a partido único)
}

type Fase = 'liga' | 'ida' | 'vuelta' | 'final';
export const faseDe = (stage: number): Fase => (stage < LIGA ? 'liga' : stage === EURO_STAGES.length - 1 ? 'final' : (stage - LIGA) % 2 === 0 ? 'ida' : 'vuelta');
/** Cruce de ida: juega en casa el peor clasificado; la vuelta, en casa del mejor */
const ida = (mejor: number, peor: number): CupTie => ({ a: peor, b: mejor, home: peor });

const tieOf = (f: { home: number; away: number }): CupTie => ({ a: f.home, b: f.away, home: f.home });

function nuevaComp(key: EuroKey, teams: number[]): EuroComp {
  // 4 jornadas sacadas de una liga todos contra todos: cada club juega contra 4 rivales distintos
  const rr = roundRobin(shuffle([...teams]));
  return { key, teams, league: shuffle(rr).slice(0, LIGA).map((r) => r.map(tieOf)), ko: [], stage: 0 };
}

/**
 * Reparte las plazas con la clasificación de cada liga (de la temporada que acaba).
 * `espana`: Primera española en orden; `copa`: campeón de Copa (va a la Europa League si no tiene plaza mejor).
 */
export function newEurope(s: GameState, espana: number[], copa?: number) {
  const listas: Record<EuroKey, number[]> = { ucl: [], uel: [], uecl: [] };
  const reparte = (code: string, orden: number[]) => {
    const [c, e, k] = PLAZAS[code];
    listas.ucl.push(...orden.slice(0, c));
    listas.uel.push(...orden.slice(c, c + e));
    listas.uecl.push(...orden.slice(c + e, c + e + k));
  };
  // el campeón de Copa entra en la Europa League si no tiene ya Champions o Europa League
  let esp = [...espana];
  const [c, e] = PLAZAS.ESP;
  if (copa !== undefined && esp.indexOf(copa) >= c + e) {
    esp = esp.filter((x) => x !== copa);
    esp.splice(c + e - 1, 0, copa);
  }
  reparte('ESP', esp);
  for (const l of s.world?.leagues ?? []) {
    const orden = l.lastTable ?? [...l.teams].sort((a, b) => bestEleven(squadOf(s, b.id)).strength - bestEleven(squadOf(s, a.id)).strength).map((t) => t.id);
    reparte(l.country, orden);
  }
  s.europe = { season: s.season, comps: EURO_KEYS.map((k) => nuevaComp(k, listas[k])), legs: true };

  const mia = myEuroComp(s);
  if (mia) {
    const info = EURO[mia.key];
    s.club.cash += info.entry;
    s.club.ledger.copa += info.entry;
    addMessage(s, {
      from: 'liga',
      title: `${info.icon} ¡Jugamos la ${info.name}!`,
      body: `Solo por participar: ${fmtMoney(info.entry)}. Fase liga de 4 jornadas (tras las jornadas ${EURO_AFTER.slice(0, LIGA).join(', ')}) y los 8 primeros pasan a cuartos (ida y vuelta). Cada victoria: ${fmtMoney(info.win)}.`,
    });
  }
}

/** Competición europea en la que estamos (si estamos en alguna) */
export const myEuroComp = (s: GameState) => (s.europe?.season === s.season ? s.europe.comps.find((c) => c.teams.includes(s.club.teamId)) : undefined);

const tiesDe = (c: EuroComp) => (c.stage < LIGA ? c.league[c.stage] : c.ko[c.stage - LIGA]) ?? [];
const toca = (s: GameState, c: EuroComp) => s.phase === 'temporada' && c.stage < EURO_STAGES.length && s.matchday >= EURO_AFTER[c.stage];

export const euroDue = (s: GameState) => s.europe?.season === s.season && s.europe.comps.some((c) => toca(s, c));
/** Nuestro partido europeo de ahora (si toca y seguimos vivos) */
export function myEuroTie(s: GameState) {
  const c = myEuroComp(s);
  if (!c || !toca(s, c)) return undefined;
  const t = tiesDe(c).find((x) => x.a === s.club.teamId || x.b === s.club.teamId);
  return t ? { comp: c, tie: t } : undefined;
}
export const myEuroDue = (s: GameState) => Boolean(myEuroTie(s));

/** Clasificación de la fase liga */
export function euroTable(c: EuroComp) {
  const filas = new Map(c.teams.map((id) => [id, { teamId: id, pj: 0, pts: 0, gf: 0, gc: 0 }]));
  for (const j of c.league) for (const t of j) {
    if (t.ga === undefined || t.gb === undefined) continue;
    const a = filas.get(t.a)!;
    const b = filas.get(t.b)!;
    a.pj++; b.pj++;
    a.gf += t.ga; a.gc += t.gb; b.gf += t.gb; b.gc += t.ga;
    if (t.ga > t.gb) a.pts += 3;
    else if (t.ga < t.gb) b.pts += 3;
    else { a.pts++; b.pts++; }
  }
  return [...filas.values()].sort((x, y) => y.pts - x.pts || y.gf - y.gc - (x.gf - x.gc) || y.gf - x.gf);
}

const resultado = (s: GameState, t: CupTie) => {
  const nos = t.a === s.club.teamId;
  const p = t.pens ? ` (penaltis ${nos ? t.pens : t.pens.split('-').reverse().join('-')})` : '';
  return nos ? `${t.ga}-${t.gb}${p}` : `${t.gb}-${t.ga}${p}`;
};

/** Juega la fase que toca de todas las competiciones europeas */
export function playEuroStage(s: GameState) {
  const mio = s.club.teamId;
  for (const c of s.europe?.comps ?? []) {
    if (!toca(s, c)) continue;
    const info = EURO[c.key];
    const fase = c.stage;
    const tipo = faseDe(fase);
    const liga = tipo === 'liga';
    const idas = tipo === 'vuelta' ? c.ko[fase - LIGA - 1] : [];
    tiesDe(c).forEach((tie, i) => {
      playTie(s, tie, `${info.name} · ${EURO_STAGES[fase]}`, c.key === 'ucl' ? 2 : 1.6, tipo !== 'final');
      if (tipo === 'vuelta') global(s, tie, idas[i]);
      if (tie.a !== mio && tie.b !== mio) return;
      const rival = teamById(s, tie.a === mio ? tie.b : tie.a)!;
      const gf = tie.a === mio ? tie.ga! : tie.gb!;
      const gc = tie.a === mio ? tie.gb! : tie.ga!;
      const pais = rival.country ? ` (${flagOf(rival.country)} ${COUNTRIES[rival.country]?.name ?? ''})` : '';
      if (liga) {
        const premio = gf > gc ? info.win : gf === gc ? info.draw : 0;
        s.club.cash += premio;
        s.club.ledger.copa += premio;
        changeMorale(s, gf > gc ? 3 : gf < gc ? -2 : 0);
        addMessage(s, {
          from: 'liga',
          title: `${info.icon} ${info.name}: ${gf > gc ? 'victoria' : gf < gc ? 'derrota' : 'empate'} ${gf}-${gc}`,
          body: `${EURO_STAGES[fase]} de la fase liga ante el ${rival.name}${pais}.${premio ? ` Premio: ${fmtMoney(premio)}.` : ''}`,
        });
        return;
      }
      if (tipo === 'ida') {
        changeMorale(s, gf > gc ? 2 : gf < gc ? -1 : 0);
        addMessage(s, {
          from: 'liga',
          title: `${info.icon} ${info.name} · ${EURO_STAGES[fase]}: ${gf}-${gc} ante el ${rival.name}`,
          body: `${gf > gc ? 'Ventaja para la vuelta' : gf < gc ? 'Toca remontar en la vuelta' : 'Todo abierto para la vuelta'}${pais}. Se juega tras la jornada ${EURO_AFTER[fase + 1]}, ${tie.home === mio ? 'a domicilio' : 'en casa'}.`,
        });
        return;
      }
      const ronda = tipo === 'final' ? 2 : (fase - LIGA - 1) / 2;
      if (tie.winner === mio) {
        const premio = info.ko[ronda];
        s.club.cash += premio;
        s.club.ledger.copa += premio;
        const final = fase === EURO_STAGES.length - 1;
        changeMorale(s, 5);
        changeSatisfaction(s, final ? (c.key === 'ucl' ? 25 : 15) : 4, final ? `¡Campeones de la ${info.name}!` : `${info.name}: pasamos ${nombreRonda(fase)}`);
        if (final) s.club.trophies.push({ season: s.season, name: info.name });
        addMessage(s, {
          from: 'liga',
          title: final ? `${info.icon} ¡¡CAMPEONES DE LA ${info.name.toUpperCase()}!!` : `${info.icon} ${info.name}: pasamos ${nombreRonda(fase)}`,
          body: `${tipo === 'vuelta' ? resultadoGlobal(s, tie) : resultado(s, tie)} ante el ${rival.name}${pais}. Premio: ${fmtMoney(premio)}.`,
        });
      } else {
        changeMorale(s, -2);
        changeSatisfaction(s, -1, `${info.name}: eliminados`);
        addMessage(s, { from: 'liga', title: tipo === 'final' ? `${info.icon} Subcampeones de la ${info.name}` : `${info.icon} ${info.name}: eliminados en ${nombreRonda(fase)}`, body: `${tipo === 'vuelta' ? resultadoGlobal(s, tie) : resultado(s, tie)} ante el ${rival.name}${pais}.` });
      }
    });
    avanza(s, c);
  }
}

/** Resultado global de una eliminatoria: la vuelta más la ida; si empatan, penaltis */
function global(s: GameState, vuelta: CupTie, primera: CupTie) {
  // en la vuelta, a es el mejor clasificado (en la ida era b)
  const ga = vuelta.ga! + primera.gb!;
  const gb = vuelta.gb! + primera.ga!;
  vuelta.agg = `${ga}-${gb}`;
  if (ga !== gb) vuelta.winner = ga > gb ? vuelta.a : vuelta.b;
  else {
    const p = penalties(bestEleven(squadOf(s, vuelta.a)).strength, bestEleven(squadOf(s, vuelta.b)).strength);
    vuelta.pens = `${p.a}-${p.b}`;
    vuelta.winner = p.a > p.b ? vuelta.a : vuelta.b;
  }
  // el resumen de nuestro partido cuenta el global
  const mio = s.club.teamId;
  if ((vuelta.a === mio || vuelta.b === mio) && s.lastReport) {
    const nos = vuelta.a === mio;
    s.lastReport.label = `${s.lastReport.label} · global ${nos ? `${ga}-${gb}` : `${gb}-${ga}`}`;
    if (vuelta.pens) s.lastReport.pens = s.lastReport.home === vuelta.a ? vuelta.pens : vuelta.pens.split('-').reverse().join('-');
  }
}

/** «cuartos», «semifinales» o «final» (sin ida ni vuelta) */
const nombreRonda = (fase: number) => EURO_STAGES[fase].replace(/ \((ida|vuelta)\)/, '').toLowerCase();

const resultadoGlobal = (s: GameState, t: CupTie) => {
  const nos = t.a === s.club.teamId;
  const [x, y] = (t.agg ?? '0-0').split('-');
  const p = t.pens ? `, penaltis ${nos ? t.pens : t.pens.split('-').reverse().join('-')}` : '';
  return `${resultado(s, { ...t, pens: undefined })} en la vuelta (global ${nos ? `${x}-${y}` : `${y}-${x}`}${p})`;
};

/** Cuartos de ida a partir de la fase liga: 1º-8º, 2º-7º, 3º-6º y 4º-5º */
export function quarterFinals(c: EuroComp) {
  const top = euroTable(c).map((r) => r.teamId).slice(0, 8);
  c.ko = [[0, 1, 2, 3].map((i) => ida(top[i], top[7 - i]))];
  c.stage = LIGA;
}

function avanza(s: GameState, c: EuroComp) {
  const mio = s.club.teamId;
  const info = EURO[c.key];
  c.stage++;
  const tipo = c.stage < EURO_STAGES.length ? faseDe(c.stage) : null;
  const orden = euroTable(c).map((r) => r.teamId);
  const mejor = (x: number, y: number) => (orden.indexOf(x) <= orden.indexOf(y) ? [x, y] : [y, x]);
  if (c.stage === LIGA) {
    quarterFinals(c);
    if (c.teams.includes(mio)) {
      const puesto = orden.indexOf(mio) + 1;
      addMessage(s, {
        from: 'liga',
        title: puesto <= 8 ? `${info.icon} ¡A cuartos de la ${info.name}!` : `${info.icon} Fuera de la ${info.name}`,
        body: `Acabamos ${puesto}º de 16 en la fase liga.${puesto > 8 ? ' Solo pasan los 8 primeros.' : ' Cuartos a ida y vuelta: la vuelta, en casa del mejor clasificado.'}`,
      });
      if (puesto > 8) changeSatisfaction(s, -2, `${info.name}: fuera en la fase liga`);
    }
  } else if (tipo === 'vuelta') {
    // la vuelta, con los campos cambiados
    c.ko.push(c.ko[c.ko.length - 1].map((t) => ({ a: t.b, b: t.a, home: t.b })));
  } else if (tipo === 'ida') {
    // semis: ganador del cruce 1 contra el del 4 y el del 2 contra el del 3
    const g = c.ko[c.ko.length - 1].map((t) => t.winner!);
    c.ko.push([mejor(g[0], g[3]), mejor(g[1], g[2])].map(([x, y]) => ida(x, y)));
  } else if (tipo === 'final') {
    const g = c.ko[c.ko.length - 1].map((t) => t.winner!);
    c.ko.push([{ a: g[0], b: g[1], home: null }]);
  } else if (c.stage === EURO_STAGES.length) {
    c.champion = c.ko[c.ko.length - 1][0].winner;
    const final = c.ko[c.ko.length - 1][0];
    addHonour(s, c.key, c.champion, final.a === c.champion ? final.b : final.a);
    if (c.champion !== mio && c.champion !== undefined) {
      const t = teamById(s, c.champion);
      if (c.teams.includes(mio) || c.key === 'ucl') {
        addMessage(s, { from: 'liga', title: `${info.icon} ${t?.name} gana la ${info.name}`, body: `${flagOf(t?.country)} Campeón de Europa${c.key === 'ucl' ? '' : ` (${info.name})`}.` });
      }
    }
  }
}

/** Mejor puesto europeo de un club en la temporada (para el valor de sus jugadores) */
export function euroBoost(s: GameState, teamId: number) {
  const c = s.europe?.season === s.season ? s.europe.comps.find((x) => x.teams.includes(teamId)) : undefined;
  return !c ? 1 : c.key === 'ucl' ? 1.12 : c.key === 'uel' ? 1.06 : 1.03;
}

export const isForeignLeagueCountry = (code: string) => (FOREIGN as readonly string[]).includes(code);
