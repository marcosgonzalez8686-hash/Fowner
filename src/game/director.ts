import { DIV_LEVEL, fmtMoney, roundMoney } from './economy';
import {
  addMessage, askingPrice, askingSalary, buyPlayer, describeMoney, marketOpen, myTeam, mySquad, myYouth,
  promoteYouth, releasePlayer, renewPlayer, renewSalary, sellPlayer, sellPrice, wageBill, willJoin,
} from './market';
import { FORMACION } from './match';
import { ourShape, ourTactics, tacticsLabel } from './coach';
import { FIT_ICON, PROFILES, TRAITS, fitBonus, fitOf } from './traits';
import { potLabel } from './scouting';
import { gauss } from './rng';
import { ownerTitle } from './identity';
import { scoutingFactor } from './land';
import { directorHandlesOffers } from './offers';
import { ROLES, ROLE_ORDER, hireStaff, staffScoutFactor, staffWages, type Role, type Staff } from './staff';
import type { Director, GameState, Level, Player, Pos, Proposal, Task } from './types';

export const TASK_LABEL: Record<Task, string> = {
  fichajes: 'Fichajes',
  ventas: 'Ventas',
  renovaciones: 'Renovaciones',
  cantera: 'Cantera',
  empleados: 'Empleados',
};

export const TASK_HELP: Record<Task, string> = {
  fichajes: 'Busca refuerzos donde la plantilla flojea, dentro del presupuesto y del tope salarial.',
  ventas: 'Vende a quien sobra o no rinde para hacer caja y aligerar salarios.',
  renovaciones: 'Renueva a los jugadores importantes cuyo contrato acaba esta temporada.',
  cantera: 'Decide qué juveniles suben al primer equipo en cada pretemporada.',
  empleados: 'Contrata entrenador, segundo, fisio, ojeadores... dentro del tope de salarios de empleados.',
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
/** Plantilla mínima que el director intenta mantener (por debajo, ficha aunque sea un fondo de armario) */
export const SQUAD_SAFE = 20;

export const levelOf = (s: GameState, t: Task): Level => (s.club.director ? s.club.delegation[t] : 'manual');

/** El director valora con más o menos acierto según su calidad */
function perceived(s: GameState, d: Director, p: Player) {
  return p.ovr + gauss(0, (6 - d.stars) * 1.3 * scoutingFactor(s) * staffScoutFactor(s));
}

function starters(squad: Player[], pos: Pos, forma: Record<Pos, number> = FORMACION) {
  return squad.filter((p) => p.pos === pos).sort((a, b) => b.ovr - a.ovr).slice(0, forma[pos]);
}

/** "Perfil: Extremo (✅ encaja con el 4-3-3 del entrenador). Carácter: 👑 Líder." */
function describeProfile(s: GameState, p: Player) {
  if (!p.profile) return '';
  const t = ourTactics(s);
  const f = fitOf(p, t.formation, t.style);
  const encaje = f > 0 ? 'encaja' : f < 0 ? 'no encaja' : 'neutro';
  const rasgos = p.traits?.length ? ` Carácter: ${p.traits.map((x) => `${TRAITS[x].icon} ${TRAITS[x].name}`).join(', ')}.` : '';
  return `Perfil: ${PROFILES[p.profile].name} (${FIT_ICON[f]} ${encaje} con el ${t.formation} del entrenador).${rasgos}\n`;
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
      // la mitad de lo ingresado vuelve al presupuesto de fichajes para reponer
      if (r.ok) s.club.transferBudget += Math.round(pr.fee / 2);
      break;
    case 'renovar':
      r = renewPlayer(s, pr.playerId, pr.salary, pr.years);
      break;
    case 'cantera':
      r = promoteYouth(s, pr.playerId);
      break;
    case 'empleado': {
      const err = hireStaff(s, pr.role, pr.staffId);
      return err;
    }
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
  // con la plantilla corta hace las operaciones que hagan falta para llegar al mínimo
  const limite = maxOps + Math.max(0, SQUAD_SAFE - mySquad(s).length);
  for (let intento = 0; intento < limite; intento++) {
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
      const tit = starters(squad, ps, ourShape(s));
      const minimo = tit.length ? tit[tit.length - 1].ovr : 0;
      if (minimo - objetivo < peor) { peor = minimo - objetivo; pos = ps; }
    }
    // con la plantilla corta se cubre la línea con menos jugadores respecto a su mínimo
    const corta = squad.length < SQUAD_SAFE;
    if (corta && peor !== -Infinity) {
      pos = (Object.keys(MIN_POS) as Pos[]).sort(
        (a, b) => squad.filter((p) => p.pos === a).length / MIN_POS[a] - squad.filter((p) => p.pos === b).length / MIN_POS[b],
      )[0];
    }
    if (!pos) return;
    const tit = starters(squad, pos, ourShape(s));
    const listón = tit.length >= ourShape(s)[pos] ? tit[tit.length - 1].ovr : 0;
    const necesitaHueco = corta || squad.filter((p) => p.pos === pos).length < MIN_POS[pos];

    // con sanción por deuda solo puede traer libres
    const presupuesto = s.club.transferBan === s.season ? 0 : Math.min(s.club.transferBudget, s.club.cash);
    // en una emergencia (menos de 18) puede pasarse un 10% del tope salarial
    // si la masa salarial ya pasa del tope, al menos puede traer jugadores baratos para completar
    const barato = roundMoney(s.club.wageCap * 0.03);
    const margenSalarial = Math.max(s.club.wageCap * (squad.length < 18 ? 1.1 : 1) - wageBill(s), corta ? barato : 0);
    const rebaja = 1 - d.stars * 0.03;

    let mejor: { p: Player; fee: number; salary: number; score: number; perc: number } | null = null;
    for (const p of s.players) {
      if (p.teamId === s.club.teamId || p.pos !== pos || p.age > 33 || p.loan) continue;
      if (alreadyProposed(s, p.id) || !willJoin(s, p)) continue;
      const fee = roundMoney(askingPrice(p) * rebaja);
      const salary = roundMoney(askingSalary(s, p) * rebaja);
      if (fee > presupuesto || salary > margenSalarial) continue;
      // también valora si encaja en el sistema del entrenador
      const t = ourTactics(s);
      const perc = perceived(s, d, p) + fitBonus(p, t.formation, t.style, -1);
      if (necesitaHueco ? perc < objetivo - 8 : perc < listón + 2) continue;
      const score = scoreSigning(d, p, fee + salary, perc);
      if (!mejor || score > mejor.score) mejor = { p, fee, salary, score, perc };
    }
    if (!mejor) {
      if (necesitaHueco) {
        warnOnce(s, `Necesito margen para fichar un ${pos}`,
          (corta ? `Solo tenemos ${squad.length} jugadores (quiero al menos ${SQUAD_SAFE}). ` : '') +
          `Nos faltan jugadores en ${pos} y con el presupuesto (${fmtMoney(s.club.transferBudget)}) y el tope salarial ` +
          `(${fmtMoney(s.club.wageCap)}, ahora usamos ${fmtMoney(wageBill(s))}) no encuentro a nadie. Súbelos en Dirección → Presupuestos.`);
      }
      return;
    }
    const { p, fee, salary, perc } = mejor;
    const years = p.age <= 24 ? 4 : p.age >= 30 ? 1 : 3;
    act(
      s, 'fichajes',
      { kind: 'fichar', playerId: p.id, fee, salary, years },
      `fichar a ${p.name} (${p.pos}, ${p.ovr})`,
      `${p.name}, ${p.age} años, ${p.pos} de media ${p.ovr} (${potLabel(p.ovr, p.pot)}).\n` +
      describeProfile(s, p) +
        `${describeMoney(fee, salary)}, ${years} temporada(s).\n` +
        `Yo le veo un nivel de ${Math.round(perc)}. ` +
        (corta ? `La plantilla está corta (${squad.length}): reforzamos ${pos}.` : necesitaHueco ? `Nos faltan jugadores en ${pos}.` : `Creo que mejora a nuestro titular más flojo en ${pos} (${listón}).`),
    );
    if (levelOf(s, 'fichajes') === 'propone') return;
    if (++ops >= limite) return;
  }
}

function doSales(s: GameState) {
  const d = s.club.director!;
  if (pendingFor(s, 'vender').length >= 2) return;
  const squad = mySquad(s).filter((p) => !p.loan); // los cedidos no son nuestros
  if (squad.length <= SQUAD_SAFE) return;
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
    const titulares = new Set((Object.keys(FORMACION) as Pos[]).flatMap((pos) => starters(squad, pos, ourShape(s)).map((p) => p.id)));
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
    if (p.contract !== 1 || p.loan || alreadyProposed(s, p.id)) continue;
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
        `Juvenil de ${y.age} años, media ${y.ovr} y ${potLabel(y.ovr, y.pot)}. Creo que puede aportar.`);
    } else if (levelOf(s, 'cantera') === 'auto') {
      releasePlayer(s, y.id);
    }
  }
}

/** El director cubre los puestos vacantes del cuerpo técnico (y mejora alguno si sobra presupuesto) */
function doStaff(s: GameState) {
  const d = s.club.director!;
  const pendientes = s.messages.filter((m) => m.status === 'pendiente' && m.proposal?.kind === 'empleado');
  const rolesPendientes = new Set(pendientes.map((m) => (m.proposal as { role: string }).role));
  let margen = s.club.staffBudget - staffWages(s);
  const sinCubrir: string[] = [];
  for (const role of ROLE_ORDER) {
    if (rolesPendientes.has(role)) continue;
    const actual = s.club.staff[role];
    const libre = margen + (actual?.salary ?? 0);
    const candidatos = (s.staffMarket[role] ?? []).filter((c) => c.salary <= libre);
    if (!candidatos.length) {
      if (!actual) sinCubrir.push(ROLES[role].name.toLowerCase());
      continue;
    }
    // el estilo del director decide entre calidad y precio
    const valor = (c: Staff) =>
      d.style === 'estrellas' ? c.stars * 10 - c.salary / 1e6
      : d.style === 'ahorrador' ? c.stars / Math.max(c.salary, 1) * 1e5
      : c.stars * 3 - c.salary / Math.max(s.club.staffBudget, 1) * 4;
    const mejor = [...candidatos].sort((a, b) => valor(b) - valor(a))[0];
    // solo se sustituye a alguien si el nuevo es claramente mejor
    if (actual && mejor.stars < actual.stars + 2) continue;
    margen -= mejor.salary - (actual?.salary ?? 0);
    act(
      s, 'empleados',
      { kind: 'empleado', role, staffId: mejor.id },
      `${actual ? 'sustituir' : 'contratar'} ${ROLES[role].name.toLowerCase()}: ${mejor.name} (${mejor.stars}★)`,
      `${mejor.name}, ${mejor.stars} estrella(s). ${mejor.trait}. Sueldo: ${fmtMoney(mejor.salary)}/temporada.` +
        (mejor.formation && mejor.style
          ? `\nJuega ${tacticsLabel(mejor.formation, mejor.style)}.`
          : '') +
        (actual ? `\nSustituiría a ${actual.name} (${actual.stars}★), con indemnización.` : '') +
        `\nTras esto quedarían ${fmtMoney(Math.max(0, margen))} libres del tope de empleados.`,
    );
  }
  if (sinCubrir.length) {
    warnOnce(s, 'No llego para cubrir todos los puestos',
      `Con el tope de salarios de empleados (${fmtMoney(s.club.staffBudget)}) no puedo contratar: ${sinCubrir.join(', ')}. Si quieres, súbelo en Dirección → Presupuestos.`);
  }
}

export type DirectorMoment = 'pretemporada' | 'jornada' | 'cambio';

/** Turno del director deportivo: actúa en las tareas que tiene delegadas */
export function runDirector(s: GameState, moment: DirectorMoment) {
  if (!s.club.director || s.gameOver) return;
  if (levelOf(s, 'cantera') !== 'manual' && s.phase === 'pretemporada') doYouth(s);
  if (marketOpen(s)) {
    directorHandlesOffers(s, levelOf(s, 'ventas'));
    if (levelOf(s, 'ventas') !== 'manual') doSales(s);
    if (levelOf(s, 'fichajes') !== 'manual') doSignings(s, moment === 'jornada' ? 1 : 3);
  }
  if (levelOf(s, 'renovaciones') !== 'manual' && s.phase === 'temporada' && s.matchday >= 28) doRenewals(s);
  if (levelOf(s, 'empleados') !== 'manual') doStaff(s);
}

/** Las propuestas que ya no se pueden ejecutar caducan */
export function expireProposals(s: GameState) {
  for (const m of s.messages) {
    if (m.status !== 'pendiente' || !m.proposal) continue;
    const k = m.proposal.kind;
    const caduca =
      ((k === 'fichar' || k === 'vender') && !marketOpen(s)) ||
      (k === 'cantera' && s.phase !== 'pretemporada') ||
      (k === 'renovar' && s.phase === 'pretemporada') ||
      (k === 'empleado' && !s.staffMarket[(m.proposal as { role: Role }).role]?.some((c) => c.id === (m.proposal as { staffId: number }).staffId));
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
    body: `Encantado, ${ownerTitle(s.club.identity)}. Mi estilo: ${STYLE_LABEL[d.style].toLowerCase()}. Dime qué tareas me encargas en Dirección → Director.`,
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
