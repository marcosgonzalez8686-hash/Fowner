import { filialSeasonCost } from './filial';
import { DIV_TV, MATCHDAYS, TV_FIXED, emptyLedger, tvMeritFactor } from './economy';
import { computeStandings } from './match';
import { diff } from './difficulty';
import { commercialPerMatch, maintenancePerSeason } from './land';
import { myTeam, wageBill } from './market';
import { staffWages } from './staff';
import { TAX_RATE, competitionPerMatchday, stadiumFine } from './costs';
import { operatingResult } from './bank';
import { sponsorFor } from './season';
import { leagueAttendance, seasonTicketForecast } from './tickets';
import type { GameState, Ledger } from './types';

export interface Projection {
  /** lo que falta por cobrar y pagar hasta el final de la liga */
  pending: Ledger;
  /** caja estimada tras cada jornada restante (empieza en la jornada actual) */
  cashPath: number[];
  cashEnd: number;
  homeMatches: number;
  /** reparto de TV por clasificación previsto (con la posición de hoy) */
  tvMerit: number;
  /** posición con la que se calcula; 0 si aún no ha empezado la liga */
  tvPos: number;
}

/** Previsión hasta final de temporada con los datos de hoy (sin fichajes ni obras nuevas) */
export function projectSeason(s: GameState): Projection {
  const t = myTeam(s);
  const pending = emptyLedger();
  const desde = s.phase === 'fin' ? MATCHDAYS : s.matchday;
  // en liga los abonados no pagan: la taquilla sale solo de las entradas sueltas
  const asis = leagueAttendance(s);
  const porJornada = {
    tv: (DIV_TV[t.division] * TV_FIXED * diff(s).income) / MATCHDAYS,
    patrocinio: (sponsorFor(s) * diff(s).income) / MATCHDAYS,
    salarios: wageBill(s) / MATCHDAYS,
    director: (s.club.director?.salary ?? 0) / MATCHDAYS,
    mantenimiento: maintenancePerSeason(s) / MATCHDAYS,
    personal: (staffWages(s) + filialSeasonCost(s)) / MATCHDAYS,
    competicion: competitionPerMatchday(t.division),
  };
  // préstamos: cuotas pendientes jornada a jornada
  const prestamos = s.club.bank.loans.map((l) => ({ ...l }));
  let caja = s.club.cash;
  // en pretemporada todavía falta cobrar la campaña de abonos
  if (s.phase === 'pretemporada') {
    pending.abonos = seasonTicketForecast(s) * s.club.seasonTickets.price;
    caja += pending.abonos;
  }
  const cashPath = [caja];
  let homeMatches = 0;
  for (let md = desde; md < MATCHDAYS; md++) {
    const enCasa = s.fixtures[t.division][md].some((f) => f.home === t.id);
    let delta = porJornada.tv + porJornada.patrocinio - porJornada.salarios - porJornada.director - porJornada.mantenimiento - porJornada.personal - porJornada.competicion;
    pending.competicion += porJornada.competicion;
    pending.tv += porJornada.tv;
    pending.patrocinio += porJornada.patrocinio;
    pending.salarios += porJornada.salarios;
    pending.director += porJornada.director;
    pending.mantenimiento += porJornada.mantenimiento;
    pending.personal += porJornada.personal;
    if (enCasa) {
      homeMatches++;
      const taquilla = asis.entradas * s.club.ticketPrice;
      const comercial = commercialPerMatch(s, asis.total, t.fans);
      pending.taquilla += taquilla;
      pending.comercial += comercial;
      delta += taquilla + comercial;
    }
    for (const l of prestamos) {
      if (l.paymentsLeft <= 0 || l.principalLeft <= 0) continue;
      const interes = l.principalLeft * (l.rate / MATCHDAYS);
      const cuota = Math.min(l.payment, l.principalLeft + interes);
      l.principalLeft -= cuota - interes;
      l.paymentsLeft--;
      pending.cuotas += cuota - interes;
      pending.intereses += interes;
      delta -= cuota;
    }
    caja += delta;
    cashPath.push(Math.round(caja));
  }
  // al cerrar la temporada: reparto variable de la TV según la posición actual (a mitad de tabla si no ha empezado)
  const ids = s.teams.filter((x) => x.division === t.division).map((x) => x.id);
  const tvPos = s.matchday > 0 ? computeStandings(ids, s.fixtures[t.division]).findIndex((r) => r.teamId === t.id) + 1 : 0;
  const tvMerit = Math.round(DIV_TV[t.division] * (1 - TV_FIXED) * (tvPos ? tvMeritFactor(tvPos, ids.length) : 1) * diff(s).income);
  pending.tv += tvMerit;
  caja += tvMerit;
  // multa por estadio e impuesto sobre el beneficio previsto
  pending.multas = stadiumFine(s, t.division);
  caja -= pending.multas;
  const total = { ...s.club.ledger };
  for (const k of Object.keys(pending) as (keyof Ledger)[]) total[k] += pending[k];
  pending.impuestos = Math.max(0, operatingResult(total)) * TAX_RATE;
  caja -= pending.impuestos;
  if (cashPath.length) cashPath[cashPath.length - 1] = Math.round(caja);
  for (const k of Object.keys(pending) as (keyof Ledger)[]) pending[k] = Math.round(pending[k]);
  return { pending, cashPath, cashEnd: Math.round(caja), homeMatches, tvMerit, tvPos };
}
