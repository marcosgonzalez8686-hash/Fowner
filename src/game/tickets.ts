import { DIV_PRICE, MATCHDAYS, fmtMoney, roundMoney } from './economy';
import { changeSatisfaction } from './fans';
import { attendanceBonus } from './land';
import { addMessage, myTeam } from './market';
import { form } from './match';
import { clamp } from './rng';
import type { GameState } from './types';

// Taquilla: abonos de temporada y entradas sueltas.
// Los abonados pagan una vez al empezar la liga y NO pagan entrada en los partidos de liga.
// Sus asientos quedan reservados aunque no vengan; las entradas sueltas solo se venden en el resto.
// La Copa no entra en el abono: ahí paga todo el que va.

export interface SeasonTickets {
  price: number; // precio del abono
  maxShare: number; // parte del aforo reservada como máximo para abonados (0-0,8)
  sold: number; // abonos vendidos esta temporada
}

export const HOME_GAMES = MATCHDAYS / 2;
export const MAX_SHARE = 0.8;

/** Precio del abono recomendado: unos 19 partidos con un 30% de descuento */
export const suggestedSeasonPrice = (s: GameState) => roundMoney(DIV_PRICE[myTeam(s).division] * HOME_GAMES * 0.7);

/** Cuánta gente quiere venir a un partido de liga (sin tener en cuenta el aforo) */
export function matchDemand(s: GameState) {
  const t = myTeam(s);
  const ref = DIV_PRICE[t.division];
  const precio = clamp(1.6 - 0.6 * (s.club.ticketPrice / ref), 0.15, 1.6);
  const racha = form(t.id, s.fixtures[t.division]);
  const animo = 1 + racha.reduce((a, r) => a + (r === 'G' ? 0.04 : r === 'P' ? -0.04 : 0), 0);
  const satisf = 0.8 + 0.4 * (s.club.satisfaction / 100);
  return t.fans * precio * animo * attendanceBonus(s) * satisf;
}

/** Relación entre el precio del abono y pagar todas las entradas sueltas */
export const seasonPriceRatio = (s: GameState) =>
  s.club.seasonTickets.price / Math.max(1, s.club.ticketPrice * HOME_GAMES);

/** Abonos que se venderían con el precio y el cupo actuales */
export function seasonTicketForecast(s: GameState) {
  const t = myTeam(s);
  const r = seasonPriceRatio(s);
  const atractivo = clamp(2.1 - 1.6 * r, 0.03, 1.4);
  const satisf = 0.7 + 0.6 * (s.club.satisfaction / 100);
  const demanda = t.fans * 0.5 * atractivo * satisf;
  const cupo = Math.floor(s.club.capacity * clamp(s.club.seasonTickets.maxShare, 0, MAX_SHARE));
  return Math.max(0, Math.round(Math.min(demanda, cupo)));
}

/** Abonados que suelen ir al campo: más cuando el equipo va bien y la afición está contenta */
function abonadosQueVan(s: GameState, abonados: number) {
  const t = myTeam(s);
  const racha = form(t.id, s.fixtures[t.division]);
  const animo = racha.reduce((a, r) => a + (r === 'G' ? 0.015 : r === 'P' ? -0.015 : 0), 0);
  return Math.round(abonados * clamp(0.75 + 0.2 * (s.club.satisfaction / 100) + animo, 0.6, 0.98));
}

export interface Attendance {
  abonados: number; // abonados que van (no pagan)
  entradas: number; // entradas vendidas (pagan)
  total: number;
}

/**
 * Asistencia a un partido de liga en casa. En pretemporada se usa la previsión de abonos.
 */
export function leagueAttendance(s: GameState): Attendance {
  const cap = s.club.capacity;
  const abonos = s.phase === 'pretemporada' ? seasonTicketForecast(s) : Math.min(s.club.seasonTickets.sold, cap);
  const demanda = matchDemand(s);
  const abonados = abonadosQueVan(s, abonos);
  // muchos abonados no vendrían a todos los partidos con entrada suelta: solo una parte
  // de ellos sale de la gente que habría comprado entrada; el resto es afición fidelizada
  const entradas = Math.round(Math.max(0, Math.min(cap - abonos, demanda - abonos * 0.55)));
  return { abonados, entradas, total: abonados + entradas };
}

/** Asistencia a un partido de Copa: no entra en el abono, todos pagan */
export function cupAttendance(s: GameState, atractivo: number) {
  return Math.round(Math.min(s.club.capacity, matchDemand(s) * atractivo));
}

/** La masa social fideliza: cada partido en casa con muchos abonados anima a la afición */
export function seasonTicketLoyalty(s: GameState) {
  const share = s.club.seasonTickets.sold / Math.max(1, s.club.capacity);
  return Math.round(share * 0.5 * 10) / 10;
}

/** Al final de temporada, una buena masa de abonados hace crecer la afición */
export const seasonTicketFansGrowth = (s: GameState) => 1 + 0.06 * (s.club.seasonTickets.sold / Math.max(1, s.club.capacity));

export function setSeasonTickets(s: GameState, price: number, maxShare: number) {
  if (s.phase !== 'pretemporada') return;
  s.club.seasonTickets.price = Math.max(10, Math.round(price));
  s.club.seasonTickets.maxShare = clamp(Math.round(maxShare * 100) / 100, 0, MAX_SHARE);
}

/** Al empezar la liga se venden los abonos y se cobra todo de una vez */
export function sellSeasonTickets(s: GameState) {
  const st = s.club.seasonTickets;
  st.sold = seasonTicketForecast(s);
  const ingreso = st.sold * st.price;
  s.club.cash += ingreso;
  s.club.ledger.abonos += ingreso;
  const r = seasonPriceRatio(s);
  if (st.sold > 0) {
    if (r > 0.9) changeSatisfaction(s, -2, 'Abonos caros');
    else if (r < 0.5) changeSatisfaction(s, 2, 'Abonos baratos');
  }
  addMessage(s, {
    from: 'club',
    title: `🎫 Campaña de abonos: ${st.sold.toLocaleString('es-ES')} abonados`,
    body:
      `Ingresos: ${fmtMoney(ingreso)} (${fmtMoney(st.price)} por abono).\n` +
      'Los abonados no pagan entrada en los partidos de liga; en Copa sí.',
  });
}

/** Al acabar la temporada: si cambiamos de categoría, se ajusta el precio de referencia */
export function seasonTicketsNewSeason(s: GameState, divisionChanged: boolean) {
  s.club.seasonTickets.sold = 0;
  if (divisionChanged) s.club.seasonTickets.price = suggestedSeasonPrice(s);
}

export const defaultSeasonTickets = (s: GameState): SeasonTickets => ({
  price: suggestedSeasonPrice(s),
  maxShare: 0.5,
  sold: 0,
});
