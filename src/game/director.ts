import { DIV_LEVEL, fmtMoney, roundMoney } from './economy';
import {
  addMessage, askingPrice, askingSalary, buyPlayer, describeMoney, marketOpen, myTeam, mySquad, myYouth,
  promoteYouth, releasePlayer, renewPlayer, renewSalary, sellPlayer, sellPrice, wageBill, willJoin,
} from './market';
import { FORMACION } from './match';
import { gauss } from './rng';
import { ownerTitle } from './identity';
import { scoutingFactor } from './land';
import { staffScoutFactor } from './staff';
import type { Director, GameState, Level, Player, Pos, Proposal, Task } from './types';

export const TASK_LABEL: Record<Task, string> = {
  fichajes: 'Fichajes',
  ventas: 'Ventas',
  renovaciones: 'Renovaciones',
  cantera: 'Cantera',
};

export const TASK_HELP: Record<Task, string> = {
  fichajes: 'Busca refuerzos donde la plantilla flojea, dentro del presupuesto y del tope salarial.',
  ventas: 'Vende a quien sobra o no rinde para hacer caja y aligerar salarios.',
  renovaciones: 'Renueva a los jugadores importantes cuyo contrato acaba esta temporada.',
  cantera: 'Decide qué juveniles suben al primer equipo en cada pretemporada.',
};

export const LEVEL_LABEL: Record<Level, string> = {
  manual: 'Manual',
  propone: 'Propone y apruebo',
  auto: 'Automático',
};

export const STYLE_LABEL: Record<Director['style'], string> = {
  equilibrado: 'Equilibrado',
  ahorrador: 'Ahorrador',
  cantera: 'Apuesta por la cantera',
  estrellas: 'Busca estrellas',
};

/** Mínimos y máximos por posición que maneja el director */
const MIN_POS: Record<Pos, number> = { POR: 2, DEF: 6, MED: 6, DEL: 4 };
const MAX_POS: Record<Pos, number> = { POR: 3, DEF: 8, MED: 8, DEL: 5 };

export const levelOf = (s: GameState, t: Task): Level => (s.club.director ? s.club.delegation[t] : 'manual');

/** El director valora con más o menos acierto según su calidad */
function perceived(s: GameState, d: Director, p: Player) {
  return p.ovr + gauss(0, (6 - d.stars) * 1.3 * scoutingFactor(s) * staffScoutFactor(s));
}

function starters(squad: Player[], pos: Pos) {
  return squad.filter((p) => p.pos === pos).sort((a, b) => b.ovr - a.ovr).slice(0, FORMACION[pos]);
}

function pendingFor(s: GameState, kind: Proposal['kind']) {
  return s.messages.filter((m) => m.status === 'pendiente' && m.proposal?.kind === kind);
}

function alreadyProposed(s: GameState, playerId: number) {
  return s.messages.some((m) => m.status === 'pendiente' && m.proposal && m.proposal.playerId === playerId);
}

/** Ejecuta una propuesta (aprobada por el dueño o en automático). Devuelve error si no se pudo. */
export function executeProposal(s: GameState, pr: Proposal): string | undefined {
  let r;
  switch (pr.kind) {
    case 'fichar':
      r = buyPlayer(s, pr.playerId, pr.fee, pr.salary, pr.years);
      if (r.ok) s.club.transferBudget = Math.max(0, s.club.transferBudget - pr.fee);
      break;
    case 'vender':
      r = sellPlayer(s, pr.playerId, pr.fee, pr.toTeamId);
      break;
    case 'renovar':
      r = renewPlayer(s, pr.playerId, pr.salary, pr.years);
      break;
    case 'cantera':
      r = promoteYouth(s, pr.playerId);
      break;
  }
  return r.ok ? undefined : r.error;
}

/** Aviso del director que solo se manda una vez por temporada */
function warnOnce(s: GameState, title: string, body: string) {
  if (s.messages.some((m) => m.season === s.season && m.title === title)) return;
  addMessage(s, { from: 'director', title, body });
}

function act(s: GameState, task: Task, pr: Proposal, title: string, body: string) {
  if (levelOf(s, task) === 'auto') {
    const err = executeProposal(s, pr);
    addMessage(s, {
      from: 'director',
      title: err ? `No se pudo: ${title}` : `Hecho: ${title}`,
      body: err ? `${body}\n\nMotivo: ${err}` : body,
    });
  } else {
    addMessage(s, { from: 'director', title: `Propuesta: ${title}`, body, proposal: pr, status: 'pendiente' });
  }
}

/** Puntuación de un fichaje según el estilo del director */
function scoreSigning(d: Director, p: Player, coste: number, perc: number) {
  switch (d.style) {
    case 'estrellas':
      return perc * 3 - coste / 1e6;
    case 'ahorrador':
      return perc - Math.log10(coste + 1000) * 6;
    case 'cantera':
      return perc + (p.age <= 23 ? (p.pot - p.ovr) * 0.8 + 4 : 0) - (p.age >= 29 ? 4 : 0);
    default:
      return perc - (p.age >= 31 ? 3 : 0) + (p.age <= 24 ? 2 : 0) - Math.log10(coste + 1000);
  }
}

function doSignings(s: GameState, maxOps: number) {
  const d = s.club.director!;
  if (pendingFor(s, 'fichar').length >= 2) return;
  let ops = 0;
  for (let intento = 0; intento < maxOps; intento++) {
    const squad = mySquad(s);
    if (squad.length >= 26) return;
    // posición con más necesidad: primero huecos, luego el titular más flojo respecto a la categoría
    const objetivo = DIV_LEVEL[myTeam(s).division];
    let pos: Pos | null = null;
    let peor = Infinity;
    for (const ps of Object.keys(FORMACION) as Pos[]) {
      const n = squad.filter((p) => p.pos === ps).length;
      if (n < MIN_POS[ps]) { pos = ps; peor = -Infinity; break; }
      if (n >= MAX_POS[ps]) continue;
      const tit = starters(squad, ps);
      const minimo = tit.length ? tit[tit.length - 1].ovr : 0;
      if (minimo - objetivo < peor) { peor = minimo - objetivo; pos = ps; }
    }
    if (!pos) return;
    const tit = starters(squad, pos);
    const listón = tit.length >= FORMACION[pos] ? tit[tit.length - 1].ovr : 0;
    const necesitaHueco = squad.filter((p) => p.pos === pos).length < MIN_POS[pos];

    const presupuesto = Math.min(s.club.transferBudget, s.club.cash);
    const margenSalarial = s.club.wageCap - wageBill(s);
    const rebaja = 1 - d.stars * 0.03;

    let mejor: { p: Player; fee: number; salary: number; score: number; perc: number } | null = null;
    for (const p of s.players) {
      if (p.teamId === s.club.teamId || p.pos !== pos || p.age > 33) continue;
      if (alreadyProposed(s, p.id) || !willJoin(s, p)) continue;
      const fee = roundMoney(askingPrice(p) * rebaja);
      const salary = roundMoney(askingSalary(s, p) * rebaja);
      if (fee > presupuesto || salary > margenSalarial) continue;
      const perc = perceived(s, d, p);
      if (necesitaHueco ? perc < objetivo - 8 : perc < listón + 2) continue;
      const score = scoreSigning(d, p, fee + salary, perc);
      if (!mejor || score > mejor.score) mejor = { p, fee, salary, score, perc };
    }
    if (!mejor) {
      if (necesitaHueco) {
        warnOnce(s, `Necesito margen para fichar un ${pos}`,
          `Nos faltan jugadores en ${pos} y con el presupuesto (${fmtMoney(s.club.transferBudget)}) y el tope salarial ` +
          `(${fmtMoney(s.club.wageCap)}, ahora usamos ${fmtMoney(wageBill(s))}) no encuentro a nadie. Súbelos en Club.`);
      }
      return;
    }
    const { p, fee, salary, perc } = mejor;
    const years = p.age <= 24 ? 4 : p.age >= 30 ? 1 : 3;
    act(
      s, 'fichajes',
      { kind: 'fichar', playerId: p.id, fee, salary, years },
      `fichar a ${p.name} (${p.pos}, ${p.ovr})`,
      `${p.name}, ${p.age} años, ${p.pos} de media ${p.ovr} (potencial ${p.pot}).\n` +
        `${describeMoney(fee, salary)}, ${years} temporada(s).\n` +
        `Yo le veo un nivel de ${Math.round(perc)}. ` +
        (necesitaHueco ? `Nos faltan jugadores en ${pos}.` : `Creo que mejora a nuestro titular más flojo en ${pos} (${listón}).`),
    );
    if (levelOf(s, 'fichajes') === 'propone') return;
    if (++ops >= maxOps) return;
  }
}

function doSales(s: GameState) {
  const d = s.club.director!;
  if (pendingFor(s, 'vender').length >= 2) return;
  const squad = mySquad(s);
  if (squad.length <= 18) return;
  let candidato: Player | null = null;
  let motivo = '';
  // 1. excedentes en alguna posición
  for (const pos of Object.keys(MAX_POS) as Pos[]) {
    // no se vende a quien acaba de llegar
    const dePos = squad.filter((p) => p.pos === pos && p.signedSeason !== s.season).sort((a, b) => a.ovr - b.ovr);
    if (squad.filter((p) => p.pos === pos).length > MAX_POS[pos] && dePos.length) {
      candidato = dePos[0];
      motivo = `Nos sobran jugadores en ${pos} (${dePos.length}).`;
      break;
    }
  }
  // 2. el ahorrador vende al veterano caro que no es titular
  if (!candidato && d.style === 'ahorrador') {
    const titulares = new Set((Object.keys(FORMACION) as Pos[]).flatMap((pos) => starters(squad, pos).map((p) => p.id)));
    candidato = squad.filter((p) => !titulares.has(p.id) && p.age >= 29 && p.signedSeason !== s.season).sort((a, b) => b.salary - a.salary)[0] ?? null;
    motivo = 'Cobra mucho para no ser titular.';
  }
  if (!candidato || alreadyProposed(s, candidato.id)) return;
  const fee = roundMoney(sellPrice(candidato) * (1 + d.stars * 0.03));
  act(
    s, 'ventas',
    { kind: 'vender', playerId: candidato.id, fee, toTeamId: 0 },
    `vender a ${candidato.name} (${candidato.pos}, ${candidato.ovr})`,
    `${candidato.name}, ${candidato.age} años, media ${candidato.ovr}, cobra ${fmtMoney(candidato.salary)}/temp.\n` +
      `Hay una oferta de ${fmtMoney(fee)}. ${motivo}`,
  );
}

function doRenewals(s: GameState) {
  const d = s.club.director!;
  const squad = mySquad(s);
  const top = new Set([...squad].sort((a, b) => b.ovr - a.ovr).slice(0, 16).map((p) => p.id));
  for (const p of squad) {
    if (p.contract !== 1 || alreadyProposed(s, p.id)) continue;
    const joven = p.age <= 23 && p.pot - p.ovr >= 5;
    if (!top.has(p.id) && !(joven && d.style === 'cantera')) continue;
    if (p.age >= 34) continue;
    const salary = roundMoney(renewSalary(p) * (1 - d.stars * 0.02));
    if (wageBill(s) - p.salary + salary > s.club.wageCap) {
      warnOnce(s, `No llego para renovar a ${p.name}`, `Pide ${fmtMoney(salary)}/temp. y nos pasaríamos del tope salarial que me has marcado (${fmtMoney(s.club.wageCap)}).`);
      continue;
    }
    const years = p.age >= 31 ? 1 : p.age <= 24 ? 4 : 2;
    act(
      s, 'renovaciones',
      { kind: 'renovar', playerId: p.id, salary, years },
      `renovar a ${p.name} (${p.pos}, ${p.ovr})`,
      `Su contrato acaba esta temporada. Propongo ${years} temporada(s) más a ${fmtMoney(salary)}/temp. (ahora cobra ${fmtMoney(p.salary)}).`,
    );
  }
}

function doYouth(s: GameState) {
  const d = s.club.director!;
  const squad = mySquad(s);
  const objetivo = DIV_LEVEL[myTeam(s).division];
  for (const y of myYouth(s)) {
    if (alreadyProposed(s, y.id)) continue;
    const exigencia = d.style === 'cantera' ? 10 : 4;
    const vale = perceived(s, d, y) >= objetivo - 6 || y.pot >= objetivo + exigencia;
    if (vale && squad.length < 26) {
      act(s, 'cantera', { kind: 'cantera', playerId: y.id }, `subir a ${y.name} (${y.pos}, ${y.ovr})`,
        `Juvenil de ${y.age} años, media ${y.ovr} y potencial ${y.pot}. Creo que puede aportar.`);
    } else if (levelOf(s, 'cantera') === 'auto') {
      releasePlayer(s, y.id);
    }
  }
}

export type DirectorMoment = 'pretemporada' | 'jornada' | 'cambio';

/** Turno del director deportivo: actúa en las tareas que tiene delegadas */
export function runDirector(s: GameState, moment: DirectorMoment) {
  if (!s.club.director || s.gameOver) return;
  if (levelOf(s, 'cantera') !== 'manual' && s.phase === 'pretemporada') doYouth(s);
  if (marketOpen(s)) {
    if (levelOf(s, 'ventas') !== 'manual') doSales(s);
    if (levelOf(s, 'fichajes') !== 'manual') doSignings(s, moment === 'jornada' ? 1 : 3);
  }
  if (levelOf(s, 'renovaciones') !== 'manual' && s.phase === 'temporada' && s.matchday >= 28) doRenewals(s);
}

/** Las propuestas que ya no se pueden ejecutar caducan */
export function expireProposals(s: GameState) {
  for (const m of s.messages) {
    if (m.status !== 'pendiente' || !m.proposal) continue;
    const k = m.proposal.kind;
    const caduca =
      ((k === 'fichar' || k === 'vender') && !marketOpen(s)) ||
      (k === 'cantera' && s.phase !== 'pretemporada') ||
      (k === 'renovar' && s.phase === 'pretemporada');
    if (caduca) m.status = 'caducada';
  }
}

export function hireDirector(s: GameState, id: number) {
  const d = s.directorsMarket.find((x) => x.id === id);
  if (!d) return;
  if (s.club.director) fireDirector(s);
  s.club.director = d;
  s.directorsMarket = s.directorsMarket.filter((x) => x.id !== id);
  addMessage(s, {
    from: 'director',
    title: `${d.name} es el nuevo director deportivo`,
    body: `Encantado, ${ownerTitle(s.club.identity)}. Mi estilo: ${STYLE_LABEL[d.style].toLowerCase()}. Dime qué tareas me encargas en la pestaña Director.`,
  });
  runDirector(s, 'cambio');
}

export function fireDirector(s: GameState) {
  const d = s.club.director;
  if (!d) return;
  // indemnización: la mitad de lo que queda de temporada
  const restante = s.phase === 'temporada' ? 1 - s.matchday / 38 : 1;
  const coste = roundMoney((d.salary * restante) / 2);
  s.club.cash -= coste;
  s.club.ledger.director += coste;
  s.club.director = null;
  for (const m of s.messages) if (m.status === 'pendiente' && m.from === 'director') m.status = 'caducada';
  addMessage(s, { from: 'club', title: `Despedido ${d.name}`, body: `Indemnización pagada: ${fmtMoney(coste)}.` });
}
