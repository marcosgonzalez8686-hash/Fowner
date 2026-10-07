import { DIV_TV, MATCHDAYS, emptyLedger } from './economy';
import { commercialPerMatch, maintenancePerSeason } from './land';
import { myTeam, wageBill } from './market';
import { expectedAttendance, sponsorFor } from './season';
import type { GameState, Ledger } from './types';

export interface Projection {
  /** lo que falta por cobrar y pagar hasta el final de la liga */
  pending: Ledger;
  /** caja estimada tras cada jornada restante (empieza en la jornada actual) */
  cashPath: number[];
  cashEnd: number;
  homeMatches: number;
}

/** Previsión hasta final de temporada con los datos de hoy (sin fichajes ni obras nuevas) */
export function projectSeason(s: GameState): Projection {
  const t = myTeam(s);
  const pending = emptyLedger();
  const desde = s.phase === 'fin' ? MATCHDAYS : s.matchday;
  const asistencia = expectedAttendance(s);
  const porJornada = {
    tv: DIV_TV[t.division] / MATCHDAYS,
    patrocinio: sponsorFor(s) / MATCHDAYS,
    salarios: wageBill(s) / MATCHDAYS,
    director: (s.club.director?.salary ?? 0) / MATCHDAYS,
    mantenimiento: maintenancePerSeason(s) / MATCHDAYS,
  };
  let caja = s.club.cash;
  const cashPath = [caja];
  let homeMatches = 0;
  for (let md = desde; md < MATCHDAYS; md++) {
    const enCasa = s.fixtures[t.division][md].some((f) => f.home === t.id);
    let delta = porJornada.tv + porJornada.patrocinio - porJornada.salarios - porJornada.director - porJornada.mantenimiento;
    pending.tv += porJornada.tv;
    pending.patrocinio += porJornada.patrocinio;
    pending.salarios += porJornada.salarios;
    pending.director += porJornada.director;
    pending.mantenimiento += porJornada.mantenimiento;
    if (enCasa) {
      homeMatches++;
      const taquilla = asistencia * s.club.ticketPrice;
      const comercial = commercialPerMatch(s, asistencia, t.fans);
      pending.taquilla += taquilla;
      pending.comercial += comercial;
      delta += taquilla + comercial;
    }
    caja += delta;
    cashPath.push(Math.round(caja));
  }
  for (const k of Object.keys(pending) as (keyof Ledger)[]) pending[k] = Math.round(pending[k]);
  return { pending, cashPath, cashEnd: Math.round(caja), homeMatches };
}
