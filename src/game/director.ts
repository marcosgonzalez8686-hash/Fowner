import { DIV_LEVEL, fmtMoney, roundMoney } from './economy';
import { filialBlock, sendToFilial } from './filial';
import {
  addMessage, askingPrice, askingSalary, describeMoney, marketOpen, myFilial, myTeam, mySquad, myYouth,
  promoteYouth, releasePlayer, renewSalary, sellPrice, wageBill, willJoin,
} from './market';
import { FORMACION } from './match';
import { ourShape, ourTactics, tacticsLabel } from './coach';
import { FIT_ICON, PROFILES, TRAITS, fitBonus, fitOf } from './traits';
import { potLabel } from './scouting';
import { gauss, randInt } from './rng';
import { ownerTitle } from './identity';
import { scoutingFactor } from './land';
import { agreedBalance, negFor, startPurchase, startRenewal } from './negotiation';
import { annualIncome } from './bank';
import { DIRECTOR_PAY, ROLES, ROLE_ORDER, hireStaff, refusesRenewal, renewalSalary, staffScoutFactor, staffWages, type Role, type Staff } from './staff';
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
/** El director no deja que los sueldos de la plantilla pasen de esta parte de los ingresos estables */
export const WAGE_SHARE = 0.7;

/** Ingresos de una temporada normal (sin ventas extraordinarias ni préstamos) */
function ingresosEstables(s: GameState) {
  return Math.max(50_000, annualIncome(s) - (s.club.lastLedger?.traspasosIn ?? 0) - (s.club.lastLedger?.copa ?? 0));
}

/** Masa salarial máxima que el director se permite: la que le marques o la prudente, la menor */
export const prudentWageCap = (s: GameState) => Math.min(s.club.wageCap, roundMoney(ingresosEstables(s) * WAGE_SHARE));

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
    case 'fichar': {
      // el director abre la negociación: empieza por debajo y como mucho paga un 10% más de lo previsto
      const tope = Math.min(roundMoney(pr.fee * 1.1), Math.max(pr.fee, s.club.transferBudget));
      // con el sueldo es prudente: empieza por debajo y apenas sube, sin pasarse de la masa salarial prudente
      const p = s.players.find((x) => x.id === pr.playerId);
      const pide = p ? askingSalary(s, p) : pr.salary;
      const margen = Math.max(0, prudentWageCap(s) - wageBill(s));
      // con la plantilla corta acepta el sueldo de mercado: es un fondo de armario barato que hace falta
      const corta = mySquad(s).length + agreedBalance(s) < SQUAD_SAFE;
      const maxSalary = roundMoney(corta ? pide * 1.1 : Math.min(pide * 1.1, Math.max(margen, pr.salary)));
      return startPurchase(s, pr.playerId, roundMoney(pr.fee * 0.85), {
        by: 'director', salary: roundMoney(pr.salary * 0.9), years: pr.years, maxFee: tope, maxSalary,
      });
    }
    case 'vender': {
      // se pone en el mercado; las ofertas llegarán y se negociarán
      const p = s.players.find((x) => x.id === pr.playerId && x.teamId === s.club.teamId);
      if (!p) return 'El jugador ya no está en el club.';
      p.listed = true;
      return;
    }
    case 'renovar':
      // el director negocia: empieza un poco por debajo y como mucho sube un 10%
      return startRenewal(s, pr.playerId, roundMoney(pr.salary * 0.95), pr.years, { by: 'director', maxSalary: roundMoney(pr.salary * 1.15) });
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
  // en "propone", los fichajes los negocia él directamente: el dueño aprueba el acuerdo final
  const negociaYa = pr.kind === 'fichar' && levelOf(s, task) === 'propone';
  if (levelOf(s, task) === 'auto' || negociaYa) {
    const err = executeProposal(s, pr);
    // sin mesa libre para negociar no se insiste ni se avisa: lo intentará más adelante
    if (err?.startsWith('Como mucho')) return;
    // fichar y vender ya no son inmediatos: se abren negociaciones
    const hecho = pr.kind === 'fichar' || pr.kind === 'renovar' ? 'Negociando' : pr.kind === 'vender' ? 'Transferible' : 'Hecho';
    addMessage(s, {
      from: 'director',
      title: err ? `No se pudo: ${title}` : `${hecho}: ${title}`,
      body: err ? `${body}\n\nMotivo: ${err}` : negociaYa ? `${body}\n\nYa estoy negociando. Te pediré el visto bueno cuando tengamos acuerdo.` : body,
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

/** Fichajes que el director tiene en marcha (cuentan como plazas ya ocupadas) */
const directorBuysOpen = (s: GameState) =>
  s.negotiations.filter((n) => n.by === 'director' && n.kind === 'compra' && (n.state === 'esperando' || n.state === 'tu_turno')).length;

function doSignings(s: GameState, maxOps: number) {
  const d = s.club.director!;
  if (pendingFor(s, 'fichar').length >= 2) return;
  // como mucho dos negociaciones suyas a la vez
  if (directorBuysOpen(s) >= 2) return;
  let ops = 0;
  // con la plantilla corta hace las operaciones que hagan falta para llegar al mínimo
  const limite = maxOps + Math.max(0, SQUAD_SAFE - mySquad(s).length - agreedBalance(s));
  for (let intento = 0; intento < limite; intento++) {
    const squad = mySquad(s);
    // los que ya tienen firmado llegar (o irse) en el próximo mercado también cuentan
    const efectiva = squad.length + agreedBalance(s) + directorBuysOpen(s);
    if (efectiva >= 26) return;
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
    const corta = efectiva < SQUAD_SAFE;
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
    // sueldo de un fondo de armario: algo menos que la media de la plantilla
    const barato = roundMoney(Math.max(s.club.wageCap * 0.03, (wageBill(s) / Math.max(1, squad.length)) * 0.8));
    const margenSalarial = Math.max(prudentWageCap(s) * (efectiva < 18 ? 1.1 : 1) - wageBill(s), corta ? barato : 0);
    const rebaja = 1 - d.stars * 0.03;

    let mejor: { p: Player; fee: number; salary: number; score: number; perc: number } | null = null;
    for (const p of s.players) {
      if (p.teamId === s.club.teamId || p.pos !== pos || p.age > 33 || p.loan) continue;
      if (alreadyProposed(s, p.id) || negFor(s, p.id) || !willJoin(s, p)) continue;
      const fee = roundMoney(askingPrice(s, p) * rebaja);
      const salary = roundMoney(askingSalary(s, p) * rebaja);
      if (fee > presupuesto || salary > margenSalarial) continue;
      // también valora si encaja en el sistema del entrenador
      const t = ourTactics(s);
      const perc = perceived(s, d, p) + fitBonus(p, t.formation, t.style, -1);
      if (necesitaHueco ? perc < objetivo - 8 : perc < listón + 2) continue;
      // con la plantilla corta manda el precio: hacen falta jugadores que cumplan, no estrellas
      const score = corta ? -(salary + fee / 3) : scoreSigning(d, p, fee + salary, perc);
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
  // 2. con la masa salarial muy por encima de lo prudente (p. ej. tras un descenso), sale el suplente que más cobra
  const sobrecoste = wageBill(s) > prudentWageCap(s) * 1.15;
  if (!candidato && (d.style === 'ahorrador' || sobrecoste)) {
    const titulares = new Set((Object.keys(FORMACION) as Pos[]).flatMap((pos) => starters(squad, pos, ourShape(s)).map((p) => p.id)));
    candidato = squad.filter((p) => !titulares.has(p.id) && (sobrecoste || p.age >= 29) && p.signedSeason !== s.season).sort((a, b) => b.salary - a.salary)[0] ?? null;
    motivo = sobrecoste
      ? `Pagamos ${fmtMoney(wageBill(s))} en sueldos y lo prudente son ${fmtMoney(prudentWageCap(s))}: cobra mucho para no ser titular.`
      : 'Cobra mucho para no ser titular.';
  }
  if (!candidato || candidato.listed || negFor(s, candidato.id) || alreadyProposed(s, candidato.id)) return;
  const fee = roundMoney(sellPrice(s, candidato) * (1 + d.stars * 0.03));
  act(
    s, 'ventas',
    { kind: 'vender', playerId: candidato.id, fee, toTeamId: 0 },
    `poner a la venta a ${candidato.name} (${candidato.pos}, ${candidato.ovr})`,
    `${candidato.name}, ${candidato.age} años, media ${candidato.ovr}, cobra ${fmtMoney(candidato.salary)}/temp.\n` +
      `Vale unos ${fmtMoney(fee)}. ${motivo} Lo pondría como transferible y negociaríamos las ofertas que lleguen.`,
  );
}

function doRenewals(s: GameState) {
  const d = s.club.director!;
  const squad = mySquad(s);
  const top = new Set([...squad].sort((a, b) => b.ovr - a.ovr).slice(0, 16).map((p) => p.id));
  // también los del filial con futuro (cobran poco y son la cantera del primer equipo)
  const promesas = new Set(myFilial(s).filter((p) => p.pot >= DIV_LEVEL[myTeam(s).division] - 2).map((p) => p.id));
  for (const p of [...squad, ...myFilial(s).filter((x) => promesas.has(x.id))]) {
    if (p.contract !== 1 || p.loan || alreadyProposed(s, p.id) || negFor(s, p.id)) continue;
    const joven = p.age <= 23 && p.pot - p.ovr >= 5;
    if (!top.has(p.id) && !promesas.has(p.id) && !(joven && d.style === 'cantera')) continue;
    if (p.age >= 34) continue;
    const salary = roundMoney(renewSalary(p) * (1 - d.stars * 0.02));
    // renovar a quien hace falta se permite siempre que no pida una subida grande;
    // lo prudente solo frena cuando la plantilla va sobrada o la subida es mucha
    // cuenta con quién se queda el año que viene: los que acaban contrato se irían
    const seQuedan = squad.filter((x) => x.contract > 1 && !x.loan && !x.retiring).length + agreedBalance(s);
    // si hace falta, se renueva salvo que dispare los sueldos: sustituirlo costaría lo mismo o más
    // una promesa del filial se renueva si sigue cobrando por debajo de la media: es barata y es el futuro
    const promesaBarata = promesas.has(p.id) && salary <= Math.max(p.salary * 1.5, wageBill(s) / Math.max(1, squad.length));
    const necesario = promesaBarata || (seQuedan < SQUAD_SAFE + 2 && (salary <= p.salary * 1.2 || wageBill(s) - p.salary + salary <= prudentWageCap(s) * 1.15));
    if (!necesario && wageBill(s) - p.salary + salary > prudentWageCap(s)) {
      warnOnce(s, `No llego para renovar a ${p.name}`, `Pide ${fmtMoney(salary)}/temp. y la masa salarial pasaría de lo prudente (${fmtMoney(prudentWageCap(s))}: el tope que me marcas o el 70% de lo que ingresamos, lo que sea menor).`);
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
  const descartados: string[] = [];
  const alFilial: string[] = [];
  for (const y of myYouth(s)) {
    if (alreadyProposed(s, y.id)) continue;
    const exigencia = d.style === 'cantera' ? 10 : 4;
    const vale = perceived(s, d, y) >= objetivo - 6 || y.pot >= objetivo + exigencia;
    // con la plantilla corta, un juvenil es la forma más barata de completarla
    if ((vale || squad.length + agreedBalance(s) < SQUAD_SAFE) && squad.length < 26) {
      act(s, 'cantera', { kind: 'cantera', playerId: y.id }, `subir a ${y.name} (${y.pos}, ${y.ovr})`,
        `Juvenil de ${y.age} años, media ${y.ovr} y ${potLabel(y.ovr, y.pot)}. Creo que puede aportar.`);
    } else if (y.pot >= objetivo - 2 && !filialBlock(s, y)) {
      // aún no está para el primer equipo, pero tiene recorrido: a foguearse al filial
      sendToFilial(s, y.id);
      alFilial.push(`${y.name} (${y.pos}, ${y.ovr}, ${potLabel(y.ovr, y.pot)})`);
    } else {
      // los que no valen los descarta él (también en "propone": solo te consulta a quién subir)
      descartados.push(`${y.name} (${y.pos}, ${y.ovr})`);
      releasePlayer(s, y.id);
    }
  }
  if (alFilial.length) {
    addMessage(s, { from: 'director', title: `Hecho: ${alFilial.length} juvenil${alFilial.length > 1 ? 'es' : ''} al filial`, body: `Aún no están para el primer equipo, pero tienen recorrido: ${alFilial.join(', ')}.` });
  }
  if (descartados.length) {
    addMessage(s, {
      from: 'director',
      title: `Hecho: ${descartados.length} juvenil${descartados.length > 1 ? 'es' : ''} no sigue${descartados.length > 1 ? 'n' : ''}`,
      body: `No los veo para el primer equipo: ${descartados.join(', ')}.`,
    });
  }
}

/** El director cubre los puestos vacantes del cuerpo técnico (y mejora alguno si sobra presupuesto) */
function doStaff(s: GameState) {
  const d = s.club.director!;
  const pendientes = s.messages.filter((m) => m.status === 'pendiente' && m.proposal?.kind === 'empleado');
  const rolesPendientes = new Set(pendientes.map((m) => (m.proposal as { role: string }).role));
  // lo ya propuesto esta temporada: no se insiste con los rechazados ni se repite el cambio de un puesto cubierto
  const propuestas = s.messages.filter((m) => m.proposal?.kind === 'empleado' && m.season === s.season);
  const rechazados = new Set(propuestas.filter((m) => m.status === 'rechazada').map((m) => (m.proposal as { staffId: number }).staffId));
  const rolesYaPropuestos = new Set(propuestas.map((m) => (m.proposal as { role: string }).role));
  let margen = s.club.staffBudget - staffWages(s);
  const sinCubrir: string[] = [];
  for (const role of ROLE_ORDER) {
    if (rolesPendientes.has(role)) continue;
    const actual = s.club.staff[role];
    // cambiar a alguien que ya está solo se plantea en pretemporada y una vez por temporada
    if (actual && (s.phase !== 'pretemporada' || rolesYaPropuestos.has(role))) continue;
    const libre = margen + (actual?.salary ?? 0);
    const candidatos = (s.staffMarket[role] ?? []).filter((c) => c.salary <= libre && !rechazados.has(c.id));
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
  d.contract ??= randInt(2, 3);
  s.club.director = d;
  s.directorsMarket = s.directorsMarket.filter((x) => x.id !== id);
  addMessage(s, {
    from: 'director',
    title: `${d.name} es el nuevo director deportivo`,
    body: `Encantado, ${ownerTitle(s.club.identity)}. Mi estilo: ${STYLE_LABEL[d.style].toLowerCase()}. Dime qué tareas me encargas en Dirección → Director.`,
  });
  runDirector(s, 'cambio');
}

/** Lo que pide el director por renovar 2 temporadas (o null si no quiere) */
export function directorRenewal(s: GameState) {
  const d = s.club.director;
  if (!d) return null;
  if (refusesRenewal(s, d.stars)) return null;
  return { years: 2, salary: renewalSalary(d.salary, DIRECTOR_PAY[d.stars - 1], d.stars) };
}

export function renewDirector(s: GameState): string | undefined {
  const d = s.club.director;
  if (!d) return 'No tienes director deportivo.';
  const r = directorRenewal(s);
  if (!r) return `${d.name} busca un club de más nivel y no quiere renovar.`;
  d.salary = r.salary;
  d.contract = (d.contract ?? 1) + r.years;
  addMessage(s, { from: 'club', title: `✍️ ${d.name} renueva`, body: `${r.years} temporadas más como director deportivo por ${fmtMoney(r.salary)}/temp.` });
}

/** Fin de temporada: corre su contrato; si acaba sin renovar, se marcha */
export function directorEndSeason(s: GameState) {
  const d = s.club.director;
  if (!d) return;
  d.contract = (d.contract ?? 2) - 1;
  if (d.contract > 0) return;
  s.club.director = null;
  for (const m of s.messages) if (m.status === 'pendiente' && m.from === 'director') m.status = 'caducada';
  addMessage(s, {
    from: 'club',
    title: `👋 ${d.name} deja el club`,
    body: 'Acabó su contrato de director deportivo sin renovar. Hasta que contrates otro (Dirección → Director), las decisiones deportivas son tuyas.',
  });
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
