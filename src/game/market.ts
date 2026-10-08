import { DIV_LEVEL, SQUAD_MAX, fairSalary, fmtMoney, playerValue, roundMoney } from './economy';
import { newId } from './generate';
import { pick } from './rng';
import type { GameState, Message, Player, Team } from './types';
import { bestEleven } from './match';
import { changeSatisfaction } from './fans';
import { changeMorale } from './morale';

export const myTeam = (s: GameState) => s.teams.find((t) => t.id === s.club.teamId)!;
// los clubes extranjeros de la Copa de Campeones viven aparte, con su plantilla
export const teamById = (s: GameState, id: number | null) => s.teams.find((t) => t.id === id) ?? s.continental?.foreign.find((t) => t.id === id);
export const squadOf = (s: GameState, teamId: number) => s.continental?.squads[teamId] ?? s.players.filter((p) => p.teamId === teamId);
export const mySquad = (s: GameState) => squadOf(s, s.club.teamId).filter((p) => !p.youth && !p.filial);
/** Jugadores en el filial (son nuestros: cobran, pero no juegan con el primer equipo) */
export const myFilial = (s: GameState) => squadOf(s, s.club.teamId).filter((p) => p.filial);
export const myYouth = (s: GameState) => squadOf(s, s.club.teamId).filter((p) => p.youth);
export const wageBill = (s: GameState) => squadOf(s, s.club.teamId).filter((p) => !p.youth).reduce((a, p) => a + p.salary, 0);

/** Mercado abierto en pretemporada y en el parón de invierno (jornadas 18 a 20) */
export function marketOpen(s: GameState) {
  return s.phase === 'pretemporada' || (s.phase === 'temporada' && s.matchday >= 18 && s.matchday <= 20);
}

/** Nota media de la temporada (de nuestros partidos o de la liga) si ha jugado lo bastante */
function seasonForm(s: GameState, p: Player) {
  if (p.season && p.season.apps >= 5) return { avg: p.season.ratingSum / p.season.apps, goals: p.season.goals };
  const l = s.leagueStats?.players[p.id];
  if (l && l.apps >= 5) return { avg: l.rsum / l.apps, goals: l.goals };
  return null;
}

/**
 * Valor de mercado: la base (media, edad y potencial) ajustada por rendimiento, contrato,
 * escaparate (categoría y Europa), lesiones y retirada.
 */
export function marketValue(s: GameState, p: Player) {
  let v = playerValue(p);
  // rendimiento de la temporada
  const f = seasonForm(s, p);
  if (f) {
    v *= 1 + Math.max(-0.15, Math.min(0.25, (f.avg - 6.3) * 0.12));
    if (p.pos === 'DEL' || p.pos === 'MED') v *= 1 + Math.min(0.2, f.goals * 0.01);
  }
  // contrato: con poco contrato vale menos (el último año, mucho menos)
  if (p.teamId !== null) v *= p.contract <= 1 ? 0.6 : p.contract === 2 ? 0.9 : 1;
  // escaparate: la categoría del club y la Copa de Campeones
  const club = teamById(s, p.teamId);
  if (club && !club.country) v *= 1 + (2 - club.division) * 0.06;
  if (club && s.continental?.season === s.season && s.continental.rounds[0]?.some((t) => t.a === club.id || t.b === club.id)) v *= 1.1;
  // lesiones largas y retirada anunciada
  if ((p.injury ?? 0) > 6) v *= 0.8;
  if (p.retiring) v *= 0.3;
  return roundMoney(v);
}

/** Variación del valor desde el inicio de la temporada (en tanto por uno), si se conoce */
export function valueTrend(s: GameState, p: Player) {
  if (!p.valueStart) return null;
  return marketValue(s, p) / p.valueStart - 1;
}

/** Precio que pide el club vendedor (0 para agentes libres) */
export function askingPrice(s: GameState, p: Player) {
  return p.teamId === null ? 0 : roundMoney(marketValue(s, p) * 1.2);
}

/** Salario que pide el jugador para venir; más si baja de categoría */
export function askingSalary(s: GameState, p: Player) {
  const base = Math.max(p.salary, fairSalary(p));
  const origen = teamById(s, p.teamId);
  const destino = myTeam(s).division;
  const bajada = origen ? Math.max(0, destino - origen.division) : 0;
  return roundMoney(base * (1.1 + bajada * 0.25));
}

/** ¿Aceptaría jugar en nuestro club? Las figuras no quieren ir a categorías muy bajas */
export function willJoin(s: GameState, p: Player) {
  return p.ovr <= DIV_LEVEL[myTeam(s).division] + 14;
}

export interface BuyResult { ok: boolean; error?: string }

export function canBuy(s: GameState, p: Player, fee: number): BuyResult {
  if (!marketOpen(s)) return { ok: false, error: 'El mercado está cerrado.' };
  if (p.teamId === s.club.teamId) return { ok: false, error: 'Ya es jugador tuyo.' };
  if (!willJoin(s, p)) return { ok: false, error: `${p.name} no quiere jugar en esta categoría.` };
  if (mySquad(s).length >= SQUAD_MAX) return { ok: false, error: `La plantilla está llena (máximo ${SQUAD_MAX}).` };
  if (s.club.cash < fee) return { ok: false, error: 'No hay dinero suficiente en caja.' };
  if (!s.players.includes(p)) return { ok: false, error: 'El jugador ya no está disponible.' };
  if (p.loan) return { ok: false, error: 'Está cedido: no se puede fichar hasta que vuelva a su club.' };
  if (fee > 0 && s.club.transferBan === s.season) return { ok: false, error: 'Sanción por deuda: esta temporada solo puedes fichar jugadores libres.' };
  return { ok: true };
}

export function buyPlayer(s: GameState, playerId: number, fee: number, salary: number, years: number): BuyResult {
  const p = s.players.find((x) => x.id === playerId);
  if (!p) return { ok: false, error: 'El jugador ya no está disponible.' };
  const check = canBuy(s, p, fee);
  if (!check.ok) return check;
  const vendedor = teamById(s, p.teamId);
  s.club.cash -= fee;
  s.club.ledger.traspasosOut += fee;
  p.teamId = s.club.teamId;
  p.salary = salary;
  p.contract = years;
  p.youth = false;
  p.signedSeason = s.season;
  // el club vendedor repone con un jugador de su nivel
  if (vendedor) replaceForTeam(s, vendedor, p.pos);
  // un fichaje que mejora el once ilusiona a la grada y al vestuario
  const xi = bestEleven(mySquad(s).filter((x) => x.id !== p.id)).xi;
  const media = xi.reduce((a, x) => a + x.ovr, 0) / Math.max(1, xi.length);
  if (p.ovr >= media + 3) {
    changeSatisfaction(s, 2, `Fichaje ilusionante: ${p.name}`);
    changeMorale(s, 2);
  }
  return { ok: true };
}

/** Club comprador para una venta: uno cuyo nivel encaje con el jugador */
export function findBuyer(s: GameState, p: Player): Team {
  let mejor = 0;
  let dif = Infinity;
  DIV_LEVEL.forEach((lvl, d) => {
    const x = Math.abs(lvl - p.ovr);
    if (x < dif) { dif = x; mejor = d; }
  });
  const candidatos = s.teams.filter((t) => t.division === mejor && t.id !== s.club.teamId);
  return pick(candidatos);
}

/** Oferta que recibirías hoy por un jugador */
export function sellPrice(s: GameState, p: Player) {
  return roundMoney(marketValue(s, p) * 0.9);
}

export function sellPlayer(s: GameState, playerId: number, fee: number, toTeamId?: number): BuyResult {
  if (!marketOpen(s)) return { ok: false, error: 'El mercado está cerrado.' };
  const p = s.players.find((x) => x.id === playerId && x.teamId === s.club.teamId);
  if (!p) return { ok: false, error: 'El jugador ya no está en el club.' };
  if (p.loan) return { ok: false, error: 'Está cedido: no es nuestro.' };
  const comprador = teamById(s, toTeamId ?? null) ?? findBuyer(s, p);
  // vender a uno de los tres mejores no gusta nada
  const top3 = [...mySquad(s)].sort((a, b) => b.ovr - a.ovr).slice(0, 3);
  if (p.traits?.includes('idolo')) changeSatisfaction(s, -6, `Venta del ídolo ${p.name}`);
  if (top3.some((x) => x.id === p.id)) {
    changeSatisfaction(s, -3, `Venta de ${p.name}, de los mejores`);
    changeMorale(s, -4);
  }
  s.club.cash += fee;
  s.club.ledger.traspasosIn += fee;
  // el comprador se queda con el jugador y suelta a otro para no inflar plantillas
  p.teamId = comprador.id;
  p.contract = Math.max(p.contract, 2);
  const sobrante = s.players
    .filter((x) => x.teamId === comprador.id && x.pos === p.pos && x.id !== p.id)
    .sort((a, b) => a.ovr - b.ovr)[0];
  if (sobrante) sobrante.teamId = null;
  return { ok: true };
}

/** Libera a un jugador: se paga la mitad del salario pendiente */
export function releasePlayer(s: GameState, playerId: number): BuyResult {
  const p = s.players.find((x) => x.id === playerId && x.teamId === s.club.teamId);
  if (!p) return { ok: false, error: 'El jugador ya no está en el club.' };
  if (p.loan) return { ok: false, error: 'Está cedido: no es nuestro.' };
  const indemnizacion = roundMoney((p.salary * Math.max(p.contract, 1)) / 2);
  s.club.cash -= indemnizacion;
  s.club.ledger.salarios += indemnizacion;
  p.teamId = null;
  p.contract = 0;
  p.youth = false;
  return { ok: true };
}

export function renewSalary(p: Player) {
  // el ambicioso aprieta, el fiel se conforma
  const caracter = p.traits?.includes('ambicioso') ? 1.25 : p.traits?.includes('fiel') ? 0.85 : 1;
  return roundMoney(Math.max(p.salary * 1.1, fairSalary(p)) * caracter);
}

export function renewPlayer(s: GameState, playerId: number, salary: number, years: number): BuyResult {
  const p = s.players.find((x) => x.id === playerId && x.teamId === s.club.teamId);
  if (!p) return { ok: false, error: 'El jugador ya no está en el club.' };
  if (p.loan) return { ok: false, error: 'Está cedido: no es nuestro.' };
  if (p.age >= 33 && years > 1) years = 1;
  p.salary = salary;
  p.contract = years + (s.phase === 'pretemporada' ? 0 : 1);
  return { ok: true };
}

export function promoteYouth(s: GameState, playerId: number): BuyResult {
  const p = s.players.find((x) => x.id === playerId && x.teamId === s.club.teamId && x.youth);
  if (!p) return { ok: false, error: 'El canterano ya no está.' };
  if (mySquad(s).length >= SQUAD_MAX) return { ok: false, error: `La plantilla está llena (máximo ${SQUAD_MAX}).` };
  p.youth = false;
  p.contract = 3;
  return { ok: true };
}

export function replaceForTeam(s: GameState, team: Team, pos: Player['pos']) {
  const libre = s.players
    .filter((x) => x.teamId === null && x.pos === pos && Math.abs(x.ovr - DIV_LEVEL[team.division]) < 6)
    .sort((a, b) => b.ovr - a.ovr)[0];
  if (libre) {
    libre.teamId = team.id;
    libre.contract = 2;
  }
}

export function addMessage(s: GameState, m: Omit<Message, 'id' | 'season' | 'matchday' | 'read'>) {
  s.messages.unshift({ ...m, id: newId(s), season: s.season, matchday: s.matchday, read: false });
  if (s.messages.length > 150) s.messages.length = 150;
}

export function describeMoney(fee: number, salary: number) {
  return `${fee > 0 ? `traspaso ${fmtMoney(fee)}` : 'libre'} · ficha ${fmtMoney(salary)}/temp.`;
}
