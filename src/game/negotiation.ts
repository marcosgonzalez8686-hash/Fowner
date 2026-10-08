import { fmtMoney, roundMoney } from './economy';
import {
  addMessage, askingPrice, askingSalary, buyPlayer, marketOpen, myTeam, mySquad, renewPlayer, renewSalary, sellPlayer, squadOf, teamById, willJoin,
} from './market';
import { bestEleven } from './match';
import { changeMorale } from './morale';
import { chance, rand, randInt } from './rng';
import { loanAnswer, loanFee, loanIn, loanOut, loanTarget } from './loans';
import { hasTrait } from './traits';
import type { GameState, Player } from './types';

// Negociaciones: nada es inmediato. Cada paso tiene respuesta a la semana (pretemporada) o a la jornada siguiente;
// se contraoferta, se agota la paciencia, aparecen otros clubes y se rompen. Se puede negociar en cualquier momento,
// pero lo acordado con el mercado cerrado se hace efectivo al abrirse el siguiente.

export type NegKind = 'compra' | 'cesion' | 'venta' | 'cedo' | 'renovacion';

export interface Negotiation {
  id: number;
  kind: NegKind; // compra/cesion: traemos a un jugador; venta/cedo: sale uno nuestro; renovacion: uno nuestro
  playerId: number;
  clubId: number | null; // el otro club (null = agente libre)
  by: 'dueño' | 'director';
  stage: 'club' | 'jugador'; // en una compra, primero el traspaso y después el contrato
  state: 'esperando' | 'tu_turno' | 'acordada' | 'cerrada' | 'rota'; // acordada = firmada, pendiente del próximo mercado
  fee: number; // nuestra última oferta (o la suya, en una venta)
  salary: number;
  years: number;
  counterFee?: number; // lo que piden (o lo que ofrecen) ahora
  counterSalary?: number;
  clubMin: number; // oculto: lo mínimo que acepta el vendedor (o lo máximo que paga el comprador)
  playerMin: number; // oculto: el sueldo mínimo que acepta el jugador
  patience: number; // rondas que aguantan antes de levantarse
  wait: number; // turnos hasta su respuesta
  expires?: number; // turnos que esperan la nuestra
  maxFee?: number; // límites del director deportivo
  maxSalary?: number;
  wantsToLeave?: boolean; // venta: al jugador le apetece el cambio
  approval?: boolean; // el director tiene el acuerdo listo y espera el visto bueno del dueño
  approved?: boolean; // el dueño ya lo ha aprobado
  log: string[];
  season: number;
}

export const MAX_ABIERTAS = 5;
export const PRE_WEEKS = 4;

export const isActive = (n: Negotiation) => n.state === 'esperando' || n.state === 'tu_turno' || n.state === 'acordada';
/** Todavía se está negociando (no está firmada) */
const enCurso = (n: Negotiation) => n.state === 'esperando' || n.state === 'tu_turno';
export const activeNegs = (s: GameState) => s.negotiations.filter(isActive);
/** Jugadores que ya tienen firmado llegar (+) o irse (−) en el próximo mercado */
export function agreedBalance(s: GameState) {
  const acordadas = s.negotiations.filter((n) => n.state === 'acordada');
  return acordadas.filter((n) => n.kind === 'compra' || n.kind === 'cesion').length - acordadas.filter((n) => n.kind === 'venta' || n.kind === 'cedo').length;
}
export const negFor = (s: GameState, playerId: number) => s.negotiations.find((n) => isActive(n) && n.playerId === playerId);
/** Las que esperan una decisión del dueño */
export const myTurn = (s: GameState) => s.negotiations.filter((n) => n.state === 'tu_turno' && (n.by === 'dueño' || n.approval));

/** Nivel de delegación de la tarea a la que pertenece la negociación (sin director, manual) */
function nivel(s: GameState, n: Negotiation) {
  if (!s.club.director) return 'manual';
  if (n.kind === 'compra' || n.kind === 'cesion') return s.club.delegation.fichajes;
  if (n.kind === 'venta' || n.kind === 'cedo') return s.club.delegation.ventas;
  return s.club.delegation.renovaciones;
}
/** En "Propone y apruebo" el director negocia, pero el acuerdo final lo aprueba el dueño (salvo renovaciones, que se aprueban al empezar) */
const necesitaVistoBueno = (s: GameState, n: Negotiation) => n.by === 'director' && n.kind !== 'renovacion' && !n.approved && nivel(s, n) === 'propone';

const turno = (s: GameState) => (s.phase === 'pretemporada' ? `Semana ${(s.preWeek ?? 0) + 1}` : `J${s.matchday}`);
const apunta = (s: GameState, n: Negotiation, texto: string) => n.log.push(`${turno(s)} · ${texto}`);
const jugador = (s: GameState, n: Negotiation) => s.players.find((p) => p.id === n.playerId);
const club = (s: GameState, n: Negotiation) => teamById(s, n.clubId);
const nombreClub = (s: GameState, n: Negotiation) => club(s, n)?.name ?? 'el club';
const añosPara = (p: Player) => (p.age <= 24 ? 4 : p.age >= 30 ? 1 : 3);

function nueva(s: GameState, n: Omit<Negotiation, 'id' | 'log' | 'season'>): Negotiation {
  const neg: Negotiation = { ...n, id: s.nextId++, log: [], season: s.season };
  s.negotiations.unshift(neg);
  // solo se guardan las de las últimas temporadas
  s.negotiations = s.negotiations.filter((x) => isActive(x) || x.season >= s.season - 1).slice(0, 60);
  return neg;
}

function rompe(s: GameState, n: Negotiation, motivo: string) {
  n.state = 'rota';
  apunta(s, n, `💔 ${motivo}`);
  const p = jugador(s, n);
  addMessage(s, { from: n.by === 'director' ? 'director' : 'club', title: `💔 Se rompe la negociación por ${p?.name ?? 'el jugador'}`, body: motivo });
}

function aSuTurno(n: Negotiation) {
  n.state = 'esperando';
  n.wait = 1;
}

function aTuTurno(n: Negotiation) {
  n.state = 'tu_turno';
  n.expires = 2;
}

// ---------- abrir negociaciones ----------

/** Oferta por un jugador de otro club (o contrato a un agente libre) */
export function startPurchase(
  s: GameState, playerId: number, fee: number, opts: { by?: 'dueño' | 'director'; salary?: number; years?: number; maxFee?: number; maxSalary?: number } = {},
): string | undefined {
  const p = s.players.find((x) => x.id === playerId);
  if (!p || p.teamId === s.club.teamId) return 'No está disponible.';
  if (p.loan) return 'Está cedido: no se puede fichar hasta que vuelva a su club.';
  if (negFor(s, playerId)) return 'Ya hay una negociación abierta por él.';
  if (s.negotiations.filter((n) => enCurso(n) && (n.kind === 'compra' || n.kind === 'cesion')).length >= MAX_ABIERTAS) return `Como mucho ${MAX_ABIERTAS} negociaciones a la vez.`;
  const libre = p.teamId === null;
  if (!libre && fee > 0 && s.club.transferBan === s.season) return 'Sanción por deuda: esta temporada solo puedes fichar jugadores libres.';
  const vendedor = teamById(s, p.teamId);
  if (vendedor?.country) return 'Juega en el extranjero.';
  // lo que de verdad aceptaría el club: más si es titular, menos si es un club pequeño
  const titular = vendedor ? bestEleven(squadOf(s, vendedor.id)).xi.some((x) => x.id === p.id) : false;
  const clubMin = libre ? 0 : roundMoney(askingPrice(s, p) * rand(0.78, 1.02) * (titular ? 1.15 : 0.95) * (vendedor!.division > myTeam(s).division ? 0.95 : 1.05));
  const playerMin = roundMoney(askingSalary(s, p) * rand(0.88, 1.08) * (hasTrait(p, 'ambicioso') ? 1.15 : 1));
  const n = nueva(s, {
    kind: 'compra', playerId, clubId: p.teamId, by: opts.by ?? 'dueño',
    stage: libre ? 'jugador' : 'club', state: 'esperando',
    fee: libre ? 0 : fee, salary: opts.salary ?? playerMin, years: opts.years ?? añosPara(p),
    clubMin, playerMin, patience: randInt(2, 4), wait: 1, maxFee: opts.maxFee, maxSalary: opts.maxSalary,
  });
  apunta(s, n, libre ? `Ofrecemos contrato: ${fmtMoney(n.salary)}/temp., ${n.years} temp.` : `Ofrecemos ${fmtMoney(fee)} al ${vendedor!.name}`);
}

/** Pedir cedido a un jugador ofreciendo una cuota */
export function startLoanIn(s: GameState, playerId: number, cuota: number): string | undefined {
  const p = s.players.find((x) => x.id === playerId);
  if (!p) return 'No está disponible.';
  if (negFor(s, playerId)) return 'Ya hay una negociación abierta por él.';
  const r = loanAnswer(s, p);
  if (!r.ok) return r.reason;
  if (s.club.transferBan === s.season) return 'Sanción por deuda: esta temporada no puedes pagar cuotas de cesión.';
  const n = nueva(s, {
    kind: 'cesion', playerId, clubId: p.teamId, by: 'dueño', stage: 'club', state: 'esperando',
    fee: cuota, salary: p.salary, years: 1, clubMin: roundMoney(loanFee(s, p) * rand(0.7, 1.3)), playerMin: 0,
    patience: randInt(1, 3), wait: 1,
  });
  apunta(s, n, `Pedimos la cesión al ${nombreClub(s, n)} ofreciendo ${fmtMoney(cuota)}`);
}

/** Ofrecer cedido a uno de nuestros jugadores */
export function startLoanOut(s: GameState, playerId: number): string | undefined {
  const p = mySquad(s).find((x) => x.id === playerId);
  if (!p || p.loan) return 'No se puede ceder.';
  if (negFor(s, playerId)) return 'Ya hay una negociación abierta por él.';
  const dest = loanTarget(s, p);
  if (!dest) return 'Nadie lo quiere cedido.';
  const n = nueva(s, {
    kind: 'cedo', playerId, clubId: dest.team.id, by: 'dueño', stage: 'club', state: 'esperando',
    fee: 0, salary: p.salary, years: 1, clubMin: 0, playerMin: 0, patience: 1, wait: 1,
  });
  apunta(s, n, `Lo ofrecemos cedido al ${dest.team.name}`);
}

/** Lo que de verdad pediría un jugador nuestro por renovar: más si viene de una gran temporada */
function renewalDemand(p: Player) {
  const nota = p.season && p.season.apps >= 5 ? p.season.ratingSum / p.season.apps : 6.3;
  const temporada = 1 + Math.max(-0.1, Math.min(0.25, (nota - 6.3) * 0.15));
  return roundMoney(renewSalary(p) * temporada * rand(0.92, 1.08));
}

/** Proponer la renovación a uno de nuestros jugadores (se puede en cualquier momento) */
export function startRenewal(
  s: GameState, playerId: number, salary: number, years: number, opts: { by?: 'dueño' | 'director'; maxSalary?: number } = {},
): string | undefined {
  const p = mySquad(s).find((x) => x.id === playerId);
  if (!p) return 'El jugador ya no está en el club.';
  if (p.loan) return 'Está cedido: no es nuestro.';
  if (p.retiring) return 'Ha anunciado que se retira.';
  if (negFor(s, playerId)) return 'Ya hay una negociación abierta con él.';
  const n = nueva(s, {
    kind: 'renovacion', playerId, clubId: null, by: opts.by ?? 'dueño', stage: 'jugador', state: 'esperando',
    fee: 0, salary, years: p.age >= 33 ? 1 : years, clubMin: 0, playerMin: renewalDemand(p),
    // el fiel tiene más paciencia; el ambicioso, menos
    patience: randInt(2, 3) + (hasTrait(p, 'fiel') ? 1 : 0) - (hasTrait(p, 'ambicioso') ? 1 : 0),
    wait: 1, maxSalary: opts.maxSalary,
  });
  apunta(s, n, `Le ofrecemos renovar: ${fmtMoney(n.salary)}/temp. y ${n.years} temp.`);
}

/** Llega una oferta de otro club por uno de nuestros jugadores */
export function newSaleOffer(s: GameState, p: Player, buyerId: number, fee: number, maxFee: number, wantsToLeave: boolean) {
  const n = nueva(s, {
    kind: 'venta', playerId: p.id, clubId: buyerId, by: 'dueño', stage: 'club', state: 'tu_turno',
    fee, salary: p.salary, years: 0, counterFee: fee, clubMin: maxFee, playerMin: 0,
    patience: randInt(1, 2), wait: 0, expires: 2, wantsToLeave,
  });
  apunta(s, n, `El ${nombreClub(s, n)} ofrece ${fmtMoney(fee)}`);
  // con las ventas delegadas, el director se encarga desde el primer momento
  if (s.club.director && s.club.delegation.ventas !== 'manual') directorSale(s, n);
  return n;
}

// ---------- nuestras respuestas ----------

const busca = (s: GameState, id: number) => s.negotiations.find((n) => n.id === id && n.state === 'tu_turno');

/** Nueva oferta (traspaso o sueldo), o en una venta pedir más dinero */
export function counter(s: GameState, id: number, v: { fee?: number; salary?: number; years?: number }): string | undefined {
  const n = busca(s, id);
  if (!n) return 'Ya no está en tu mano.';
  if (n.kind === 'venta') {
    n.fee = v.fee ?? n.fee;
    apunta(s, n, `Pedimos ${fmtMoney(n.fee)}`);
  } else if (n.stage === 'club') {
    n.fee = v.fee ?? n.fee;
    apunta(s, n, `Subimos la oferta a ${fmtMoney(n.fee)}`);
  } else {
    n.salary = v.salary ?? n.salary;
    n.years = v.years ?? n.years;
    apunta(s, n, `Ofrecemos ${fmtMoney(n.salary)}/temp. y ${n.years} temp.`);
  }
  aSuTurno(n);
}

/** Aceptar lo que piden (o lo que ofrecen) */
export function acceptTerms(s: GameState, id: number): string | undefined {
  const n = busca(s, id);
  if (!n) return 'Ya no está en tu mano.';
  if (n.kind === 'venta') {
    n.fee = n.counterFee ?? n.fee;
    apunta(s, n, `Aceptamos ${fmtMoney(n.fee)}`);
    return cierra(s, n);
  }
  if (n.stage === 'club') {
    n.fee = n.counterFee ?? n.fee;
    apunta(s, n, `Aceptamos ${fmtMoney(n.fee)}`);
    return acuerdoConClub(s, n);
  }
  n.salary = n.counterSalary ?? n.salary;
  apunta(s, n, `Aceptamos ${fmtMoney(n.salary)}/temp.`);
  return cierra(s, n);
}

/** Retirarse (o rechazar la oferta, en una venta) */
export function withdraw(s: GameState, id: number): string | undefined {
  const n = s.negotiations.find((x) => x.id === id && isActive(x));
  if (!n) return 'Ya no está abierta.';
  const p = jugador(s, n);
  n.state = 'rota';
  apunta(s, n, n.kind === 'venta' ? 'Rechazamos la oferta' : 'Nos retiramos');
  if (n.kind === 'venta' && p) {
    if (n.wantsToLeave) {
      changeMorale(s, -3);
      addMessage(s, { from: 'club', title: `😒 ${p.name} está molesto`, body: 'Quería dar el salto y no le has dejado.' });
    }
    if (hasTrait(p, 'conflictivo')) {
      changeMorale(s, -2);
      addMessage(s, { from: 'club', title: `😤 ${p.name} no se calla`, body: 'Se entera de que has rechazado la oferta y lo cuenta en el vestuario.' });
    }
  }
}

// ---------- el paso del tiempo ----------

/** Pasa una semana (o una jornada del parón): llegan respuestas y se agota la paciencia */
export function tickNegotiations(s: GameState) {
  for (const n of s.negotiations.filter(enCurso)) {
    if (n.state === 'tu_turno') {
      n.expires = (n.expires ?? 2) - 1;
      if (n.expires <= 0 && n.approval) rompe(s, n, 'Se cansan de esperar tu visto bueno y se rompe el acuerdo.');
      else if (n.expires <= 0) rompe(s, n, n.kind === 'venta' ? `El ${nombreClub(s, n)} se cansa de esperar y retira la oferta.` : 'No contestamos a tiempo y se cansan de esperar.');
      continue;
    }
    n.wait--;
    if (n.wait <= 0) responde(s, n);
  }
  directorNegotiates(s);
}

function responde(s: GameState, n: Negotiation) {
  const p = jugador(s, n);
  if (!p || (n.kind !== 'venta' && n.kind !== 'cedo' && p.teamId !== n.clubId && n.stage === 'club')) {
    rompe(s, n, 'El jugador ya no está disponible.');
    return;
  }
  if (n.kind === 'cedo') {
    if (chance(0.75)) cierra(s, n);
    else rompe(s, n, `El ${nombreClub(s, n)} no lo ve claro y prefiere no hacerse cargo de él.`);
    return;
  }
  if (n.kind === 'venta') {
    // pedimos más: si no pasa de su tope, aceptan; si no, pueden mejorar o irse
    if (n.fee <= n.clubMin) {
      apunta(s, n, `El ${nombreClub(s, n)} acepta ${fmtMoney(n.fee)}`);
      cierra(s, n);
    } else if (n.patience > 0 && chance(0.65)) {
      n.patience--;
      n.counterFee = roundMoney(Math.min(n.clubMin, ((n.counterFee ?? n.fee) + n.clubMin) / 2 + n.clubMin * 0.02));
      apunta(s, n, `El ${nombreClub(s, n)} no llega, pero mejora a ${fmtMoney(n.counterFee)}`);
      aTuTurno(n);
    } else rompe(s, n, `El ${nombreClub(s, n)} no está dispuesto a pagar tanto y se retira.`);
    return;
  }
  if (n.stage === 'club') {
    // imprevistos: otro club entra en la puja o el vendedor se echa atrás
    if (n.kind === 'compra' && chance(0.08)) {
      n.clubMin = roundMoney(n.clubMin * 1.15);
      apunta(s, n, '⚠️ Otro club ha entrado en la puja: el precio sube');
    } else if (n.kind === 'compra' && chance(0.04)) {
      rompe(s, n, `El ${nombreClub(s, n)} cambia de idea: ya no quiere venderlo.`);
      return;
    }
    if (n.fee >= n.clubMin) {
      apunta(s, n, `El ${nombreClub(s, n)} acepta ${fmtMoney(n.fee)}`);
      acuerdoConClub(s, n);
    } else if (n.fee < n.clubMin * 0.6 || n.patience <= 0) {
      rompe(s, n, `El ${nombreClub(s, n)} considera la oferta insuficiente y se levanta de la mesa.`);
    } else {
      n.patience--;
      n.counterFee = roundMoney(Math.max(n.clubMin, (n.clubMin * 1.2 + n.fee) / 2));
      apunta(s, n, `El ${nombreClub(s, n)} pide ${fmtMoney(n.counterFee)}`);
      aTuTurno(n);
    }
    return;
  }
  if (n.kind === 'renovacion' && p.teamId !== s.club.teamId) {
    rompe(s, n, `${p.name} ya no está en el club.`);
    return;
  }
  // con el jugador
  if (n.kind === 'compra' && !willJoin(s, p)) {
    rompe(s, n, `${p.name} no quiere jugar en nuestra categoría.`);
    return;
  }
  if (chance(0.1)) {
    n.playerMin = roundMoney(n.playerMin * 1.1);
    apunta(s, n, '⚠️ Su agente sube lo que pide');
  }
  if (n.salary >= n.playerMin) cierra(s, n);
  else if (n.salary < n.playerMin * 0.7 || n.patience <= 0) {
    rompe(s, n, n.kind === 'renovacion'
      ? `${p.name} se siente infravalorado y rompe las negociaciones. Puedes volver a intentarlo más adelante.`
      : `${p.name} no se ve en el proyecto y rechaza la oferta.`);
  }
  else {
    n.patience--;
    n.counterSalary = roundMoney(Math.max(n.playerMin, (n.playerMin * 1.12 + n.salary) / 2));
    apunta(s, n, `${p.name} pide ${fmtMoney(n.counterSalary)}/temp.`);
    aTuTurno(n);
  }
}

/** Acuerdo de traspaso: la cesión se cierra; en una compra falta convencer al jugador */
function acuerdoConClub(s: GameState, n: Negotiation) {
  if (n.kind === 'cesion') return cierra(s, n);
  n.stage = 'jugador';
  n.patience = Math.max(n.patience, 2);
  n.counterSalary = roundMoney(n.playerMin * rand(1.05, 1.2));
  apunta(s, n, `Ahora toca el jugador: pide ${fmtMoney(n.counterSalary)}/temp.`);
  aTuTurno(n);
}

/** Firma: con el mercado abierto se hace ya; si no, queda acordada para el próximo mercado */
function cierra(s: GameState, n: Negotiation): string | undefined {
  if (necesitaVistoBueno(s, n)) {
    const p = jugador(s, n);
    n.approval = true;
    aTuTurno(n);
    apunta(s, n, '📋 Acuerdo listo: falta tu visto bueno');
    addMessage(s, {
      from: 'director',
      title: `📋 Acuerdo listo: ${p?.name ?? 'jugador'}`,
      body: `${resumenAcuerdo(s, n)}\n\nApruébalo o recházalo en Inicio o en Equipo → Mercado. Esperan respuesta ${s.phase === 'pretemporada' ? 'un par de semanas' : 'un par de jornadas'}.`,
    });
    return;
  }
  // las renovaciones no dependen del mercado
  if (marketOpen(s) || n.kind === 'renovacion') return ejecuta(s, n);
  const p = jugador(s, n);
  n.state = 'acordada';
  apunta(s, n, '✍️ Acuerdo firmado: se hará efectivo en el próximo mercado');
  addMessage(s, {
    from: n.by === 'director' ? 'director' : 'club',
    title: `✍️ Acuerdo cerrado: ${p?.name ?? 'jugador'}`,
    body: `${TEXTO_ACUERDO[n.kind]} Se hará efectivo cuando abra el mercado (pretemporada o jornada 19).`,
  });
}

/** Condiciones del acuerdo en una frase */
export function resumenAcuerdo(s: GameState, n: Negotiation) {
  const p = jugador(s, n);
  const nombre = p?.name ?? 'el jugador';
  if (n.kind === 'venta') return `Vender a ${nombre} al ${nombreClub(s, n)} por ${fmtMoney(n.fee)}.`;
  if (n.kind === 'cedo') return `Ceder a ${nombre} al ${nombreClub(s, n)} una temporada (pagan su ficha).`;
  if (n.kind === 'cesion') return `Traer cedido a ${nombre} del ${nombreClub(s, n)} por una cuota de ${fmtMoney(n.fee)}.`;
  if (n.kind === 'renovacion') return `Renovar a ${nombre}: ${fmtMoney(n.salary)}/temp., ${n.years} temp.`;
  return `Fichar a ${nombre}${n.clubId !== null ? ` del ${nombreClub(s, n)} por ${fmtMoney(n.fee)}` : ' (libre)'}: ${fmtMoney(n.salary)}/temp., ${n.years} temp.`;
}

/** El dueño da el visto bueno a un acuerdo que ha cerrado el director */
export function approveDeal(s: GameState, id: number): string | undefined {
  const n = s.negotiations.find((x) => x.id === id && x.state === 'tu_turno' && x.approval);
  if (!n) return 'Ya no está pendiente.';
  n.approval = false;
  n.approved = true;
  apunta(s, n, '👍 Das el visto bueno');
  return cierra(s, n);
}

const TEXTO_ACUERDO: Record<NegKind, string> = {
  compra: 'Fichaje acordado: llegará y se pagará el traspaso',
  cesion: 'Cesión acordada: llegará',
  venta: 'Venta acordada: se irá y cobraremos el traspaso',
  cedo: 'Cesión acordada: se irá cedido',
  renovacion: 'Renovación acordada.',
};

/** Al abrirse el mercado se ejecuta todo lo que estaba acordado */
export function executeAgreed(s: GameState) {
  for (const n of s.negotiations.filter((x) => x.state === 'acordada')) {
    const p = jugador(s, n);
    if (!p) {
      rompe(s, n, 'El jugador se ha retirado o ya no está en activo.');
      continue;
    }
    if ((n.kind === 'compra' || n.kind === 'cesion') && p.teamId !== n.clubId) {
      // si su contrato acabó y quedó libre, viene igual (y sin traspaso)
      if (n.kind === 'compra' && p.teamId === null) {
        n.fee = 0;
        apunta(s, n, 'Su contrato con el club acabó: llega libre');
      } else {
        rompe(s, n, 'El jugador ya no está en ese club.');
        continue;
      }
    }
    if ((n.kind === 'venta' || n.kind === 'cedo') && p.teamId !== s.club.teamId) {
      rompe(s, n, 'El jugador ya no está en el club.');
      continue;
    }
    ejecuta(s, n);
  }
}

/** Firma final */
function ejecuta(s: GameState, n: Negotiation): string | undefined {
  const p = jugador(s, n);
  if (!p) return void rompe(s, n, 'El jugador ya no está.');
  let err: string | undefined;
  let titulo = '';
  if (n.kind === 'compra') {
    const r = buyPlayer(s, p.id, n.fee, n.salary, n.years);
    err = r.ok ? undefined : r.error;
    titulo = `✅ ¡${p.name} ficha por el club!`;
    if (!err && n.by === 'director') s.club.transferBudget = Math.max(0, s.club.transferBudget - n.fee);
  } else if (n.kind === 'renovacion') {
    const r = renewPlayer(s, p.id, n.salary, n.years);
    err = r.ok ? undefined : r.error;
    titulo = `✍️ ${p.name} renueva`;
  } else if (n.kind === 'cesion') {
    const r = loanIn(s, p.id, n.fee);
    err = r.includes('llega cedido') ? undefined : r;
    titulo = `✅ ${p.name} llega cedido`;
  } else if (n.kind === 'cedo') {
    const r = loanOut(s, p.id);
    err = r.includes('cedido al') ? undefined : r;
    titulo = `✅ ${p.name} sale cedido`;
  } else {
    const r = sellPlayer(s, p.id, n.fee, n.clubId ?? undefined);
    err = r.ok ? undefined : r.error;
    titulo = `✅ ${p.name} vendido al ${nombreClub(s, n)}`;
    if (!err && n.by === 'director') s.club.transferBudget += Math.round(n.fee / 2);
  }
  if (err) {
    rompe(s, n, err);
    return err;
  }
  n.state = 'cerrada';
  apunta(s, n, '🤝 Operación cerrada');
  addMessage(s, {
    from: n.by === 'director' ? 'director' : 'club',
    title: titulo,
    body: n.kind === 'renovacion' ? `${n.years} temporada(s) más a ${fmtMoney(n.salary)}/temp.` : n.kind === 'compra' ? `Traspaso: ${fmtMoney(n.fee)} · Sueldo: ${fmtMoney(n.salary)}/temp., ${n.years} temp.` : n.kind === 'venta' ? `Traspaso cerrado por ${fmtMoney(n.fee)}.` : n.kind === 'cesion' ? `Cuota: ${fmtMoney(n.fee)}.` : 'Vuelve al acabar la temporada.',
  });
}

// ---------- el director deportivo ----------

/** Consejo del director sobre una oferta que hemos recibido */
export function saleAdvice(s: GameState, n: Negotiation): { action: 'aceptar' | 'pedir' | 'rechazar'; text: string } {
  const p = jugador(s, n);
  if (!p) return { action: 'rechazar', text: '' };
  const valor = askingPrice(s, p) / 1.2;
  const ratio = (n.counterFee ?? n.fee) / Math.max(1, valor);
  const clave = !p.listed && [...mySquad(s)].sort((a, b) => b.ovr - a.ovr).slice(0, 3).some((x) => x.id === p.id);
  if (mySquad(s).length <= 20) return { action: 'rechazar', text: 'Nos quedaríamos cortos de plantilla.' };
  // a un ídolo solo se le vende si el dueño lo ha puesto en la lista
  if (hasTrait(p, 'idolo') && !p.listed) return { action: 'rechazar', text: 'Es un ídolo de la grada: venderlo nos costaría muy caro con la afición.' };
  if (ratio >= (clave ? 1.4 : p.listed ? 0.85 : 1.1)) return { action: 'aceptar', text: 'Es una buena oferta.' };
  if (ratio >= (clave ? 1.0 : 0.75) && n.log.length < 3) return { action: 'pedir', text: 'Pidamos un 15% más: creo que pueden subir.' };
  return { action: 'rechazar', text: clave ? 'Es de nuestros mejores: así no se vende.' : 'Se queda corta para lo que vale.' };
}

/** El director decide sobre una oferta recibida: rechaza las que no valen, pide más o la acepta (con visto bueno si propone) */
function directorSale(s: GameState, n: Negotiation) {
  n.by = 'director';
  const c = saleAdvice(s, n);
  if (c.action === 'aceptar') acceptTerms(s, n.id);
  else if (c.action === 'pedir') counter(s, n.id, { fee: roundMoney((n.counterFee ?? n.fee) * 1.15) });
  else {
    const p = jugador(s, n);
    withdraw(s, n.id);
    addMessage(s, {
      from: 'director',
      title: `Oferta por ${p?.name ?? 'un jugador'} rechazada`,
      body: `El ${nombreClub(s, n)} ofrecía ${fmtMoney(n.counterFee ?? n.fee)}. ${c.text}`,
    });
  }
}

/** El director lleva sus propias negociaciones (y las ventas, si se las has delegado) */
function directorNegotiates(s: GameState) {
  const d = s.club.director;
  if (!d) return;
  const ventasDelegadas = s.club.delegation.ventas !== 'manual';
  for (const n of s.negotiations.filter((x) => x.state === 'tu_turno' && !x.approval)) {
    if (n.kind === 'venta') {
      if (ventasDelegadas) directorSale(s, n);
      continue;
    }
    if (n.by !== 'director') continue;
    if (n.stage === 'club') {
      const pide = n.counterFee ?? n.fee;
      if (pide <= (n.maxFee ?? n.fee)) acceptTerms(s, n.id);
      else if (n.fee >= (n.maxFee ?? n.fee)) withdraw(s, n.id);
      else counter(s, n.id, { fee: roundMoney(Math.min(n.maxFee ?? n.fee, (n.fee + pide) / 2)) });
    } else {
      const pide = n.counterSalary ?? n.salary;
      if (pide <= (n.maxSalary ?? n.salary)) acceptTerms(s, n.id);
      else if (n.salary >= (n.maxSalary ?? n.salary)) withdraw(s, n.id);
      else counter(s, n.id, { salary: roundMoney(Math.min(n.maxSalary ?? n.salary, (n.salary + pide) / 2)) });
    }
  }
}
