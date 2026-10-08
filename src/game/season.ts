import {
  DIV_FANS, DIV_LEVEL, DIV_SPONSOR, DIV_TV, DIVISION_NAMES, DIVISIONS, MATCHDAYS, PROMOTE, DIRECT_UP, PLAYOFF_FROM, PLAYOFF_TO,
  SQUAD_TARGET, emptyLedger, fmtMoney, ledgerExpense, ledgerIncome, roundMoney,
} from './economy';
import { expireProposals, levelOf, runDirector } from './director';
import { buildAllFixtures, makeDirectors, makePlayer } from './generate';
import { addMessage, marketOpen, marketValue, myTeam, mySquad, myYouth, teamById, wageBill } from './market';
import { bestEleven, chooseStyle, computeStandings, simulate, type Formation } from './match';
import { conflictAfterMatch, newIdols } from './traits';
import { matchKeys } from './insights';
import { contDue, myContDue, mySuperDue, newContinental, newSupercopa, playContinentalRound, playSupercopa, superDue } from './continental';
import { returnLoans } from './loans';
import { recoverAll, tire } from './fatigue';
import { competitionPerMatchday, promotionClauses, seasonFinances, stadiumFine, STADIUM_REQ } from './costs';
import { markKnown, scoutingNewSeason } from './scouting';
import { announceRetirements, develop, farewells, retireChance } from './aging';
import { coachAfterMatch, coachEndSeason, ourPlan, ourTactics } from './coach';
import { chance, clamp, gauss, rand, randInt } from './rng';
import type { GameState, MatchResult, Player, Standing, Team } from './types';
import { recordMatch, recordSeason } from './history';
import { buildReport, type MatchReport } from './report';
import { bestXIOf, emptyStats, harvest, leaders } from './stats';
import {
  makeStaffCandidates, marketingFansBonus, scoutDiscoveries, staffAgingFactor, staffMatchBonus, staffWages, youthGrowthBonus,
} from './staff';
import { refreshSponsorOffers, sponsorFixed, sponsorPerWin, sponsorsEndSeason } from './sponsor';
import { maybeCreateEvent } from './events';
import { cupRoundDue, newCup, playCupRound, stillIn } from './cup';
import { generateOffers } from './offers';
import { growFacilities } from './rivals';
import { resetYellows } from './discipline';
import { aiTransfers } from './aitransfers';
import { finishPlayoffs, myPlayoffDue, playoffWinner, startPlayoffs } from './playoff';
import { PRE_WEEKS, executeAgreed, tickNegotiations } from './negotiation';
import { payDividends, payLoans, refreshInvestorOffers } from './bank';
import { leagueAttendance, seasonTicketFansGrowth, seasonTicketLoyalty, seasonTicketsNewSeason, sellSeasonTickets } from './tickets';
import { changeMorale, healOneMatchday, injuryName, isInjured, moraleAfterMatch, moraleBonus, resetSeasonMorale, rollInjuries } from './morale';
import { changeSatisfaction, fansExpectationMessage, fansGrowthSatisfaction, objectiveMet, satisfactionAfterMatch, satisfactionEndSeason } from './fans';
import {
  agingFactor, commercialPerMatch, fansGrowthBonus, maintenancePerSeason,
} from './land';

export const creditLimit = (s: GameState) => {
  const d = myTeam(s).division;
  return roundMoney((DIV_TV[d] + DIV_SPONSOR[d]) * 0.5 + 40_000);
};

/** Patrocinio fijo de la temporada */
export const sponsorFor = (s: GameState) => sponsorFixed(s);

/** Asistencia total esperada a un partido de liga en casa (abonados que van + entradas vendidas) */
export function expectedAttendance(s: GameState) {
  return leagueAttendance(s).total;
}

/** Pretemporada: pasa una semana (avanzan las negociaciones, llegan ofertas y el director trabaja) */
export function advanceWeek(s: GameState): string | undefined {
  if (s.phase !== 'pretemporada') return 'Solo en pretemporada.';
  if ((s.preWeek ?? 0) >= PRE_WEEKS - 1) return 'Es la última semana de pretemporada: toca empezar la liga.';
  s.preWeek = (s.preWeek ?? 0) + 1;
  tickNegotiations(s);
  aiTransfers(s);
  generateOffers(s, 1);
  runDirector(s, 'pretemporada');
}

export function startSeason(s: GameState): string | undefined {
  if (s.phase !== 'pretemporada') return;
  if (!s.club.sponsors.camiseta && s.sponsorOffers.camiseta?.length) return 'Antes de empezar, firma un patrocinador de camiseta.';
  if (!s.club.objective) return 'Antes de empezar, fija el objetivo de la temporada.';
  // los juveniles sin decidir se van
  for (const y of myYouth(s)) { y.teamId = null; y.youth = false; }
  s.phase = 'temporada';
  // punto de partida para ver quién se revaloriza durante la temporada
  for (const p of s.players) p.valueStart = marketValue(s, p);
  sellSeasonTickets(s);
  expireProposals(s);
  addMessage(s, {
    from: 'liga',
    title: `Arranca la temporada ${s.season}`,
    body: `Jugamos en ${DIVISION_NAMES[myTeam(s).division]}. El mercado cierra hasta el parón de invierno (jornadas 19 a 21).`,
  });
  const d = myTeam(s).division;
  if (stadiumFine(s, d) > 0) {
    addMessage(s, {
      from: 'liga',
      title: '⚠️ El estadio no cumple el aforo mínimo',
      body:
        `${DIVISION_NAMES[d]} exige ${STADIUM_REQ[d].toLocaleString('es-ES')} espectadores y tenemos ${s.club.capacity.toLocaleString('es-ES')}. ` +
        `Si al acabar la liga seguimos así, multa de ${fmtMoney(stadiumFine(s, d))}. Amplía el estadio en Club → Instalaciones.`,
    });
  }
}

export function playMatchday(s: GameState) {
  if (s.phase !== 'temporada' || s.gameOver) return;
  // si toca Copa: la nuestra se juega aparte; si ya estamos eliminados, se simula sola
  // la Supercopa abre la temporada; la Copa de Campeones va entre semana
  if (superDue(s)) {
    if (mySuperDue(s)) return;
    playSupercopa(s);
  }
  while (cupRoundDue(s)) {
    if (stillIn(s)) return;
    playCupRound(s);
  }
  while (contDue(s)) {
    if (myContDue(s)) return;
    playContinentalRound(s);
  }
  const porEquipo = new Map<number, Player[]>();
  for (const p of s.players) {
    if (p.teamId === null) continue;
    if (!porEquipo.has(p.teamId)) porEquipo.set(p.teamId, []);
    porEquipo.get(p.teamId)!.push(p);
  }
  const extra = staffMatchBonus(s) + moraleBonus(s);
  // once titular de cada equipo (sin lesionados), calculado una sola vez por jornada
  // nuestro once lo pone el entrenador con su sistema; los rivales, con el que mejor les va
  const onces = new Map<number, { xi: Player[]; strength: number; formation: Formation }>();
  const once = (id: number) => {
    if (!onces.has(id)) onces.set(id, id === s.club.teamId ? ourPlan(s, porEquipo.get(id) ?? []) : bestEleven(porEquipo.get(id) ?? []));
    return onces.get(id)!;
  };
  const fuerza = (id: number) => once(id).strength + (id === s.club.teamId ? extra : 0);
  const lesionadosAntes = new Set(s.players.filter((p) => isInjured(p)).map((p) => p.id));
  const mio = myTeam(s);
  const md = s.matchday;
  s.lastResults = [];

  if (s.leagueStats?.season !== s.season) s.leagueStats = emptyStats(s.season);
  const informes: MatchReport[][] = Array.from({ length: DIVISIONS }, () => []);
  for (let d = 0; d < DIVISIONS; d++) {
    for (const f of s.fixtures[d][md]) {
      // pequeño factor anímico aleatorio por partido
      // cada entrenador elige estilo según cómo ve el partido
      // (el nuestro siempre juega a lo suyo)
      const sh = f.home === s.club.teamId ? ourTactics(s).style : chooseStyle(fuerza(f.home), fuerza(f.away), true);
      const sa = f.away === s.club.teamId ? ourTactics(s).style : chooseStyle(fuerza(f.away), fuerza(f.home), false);
      const fh = fuerza(f.home) + 2 + gauss(0, 2);
      const fa = fuerza(f.away) + gauss(0, 2);
      const { hg, ag } = simulate(fh, fa, sh, sa);
      f.hg = hg;
      f.ag = ag;
      const r: MatchResult = { home: f.home, away: f.away, hg, ag };
      if (f.home === mio.id) {
        // los abonados no pagan entrada: solo cuentan las entradas sueltas
        const asis = leagueAttendance(s);
        r.attendance = asis.total;
        r.abonados = asis.abonados;
        const ingreso = asis.entradas * s.club.ticketPrice;
        changeSatisfaction(s, seasonTicketLoyalty(s), 'Ambiente de los abonados');
        const comercial = commercialPerMatch(s, r.attendance, mio.fans);
        s.club.cash += ingreso + comercial;
        s.club.ledger.taquilla += ingreso;
        s.club.ledger.comercial += comercial;
      }
      // informe de cada partido: goleadores, asistencias y notas para las estadísticas de la liga
      const rep = buildReport(
        { season: s.season, matchday: md + 1, home: f.home, away: f.away, hg, ag },
        once(f.home).xi,
        once(f.away).xi,
        fh,
        fa,
        { home: { formation: once(f.home).formation, style: sh }, away: { formation: once(f.away).formation, style: sa } },
      );
      harvest(s, rep);
      // partidos de los cedidos (en ambos sentidos)
      for (const p of [...once(f.home).xi, ...once(f.away).xi]) if (p.loan) p.loan.apps++;
      informes[d].push(rep);
      if (f.home === mio.id || f.away === mio.id) {
        if (r.attendance !== undefined) {
          rep.attendance = r.attendance;
          rep.abonados = r.abonados;
          rep.revenue = (r.attendance - (r.abonados ?? 0)) * s.club.ticketPrice + commercialPerMatch(s, r.attendance, mio.fans);
        }
        const casa = f.home === mio.id;
        rep.keys = matchKeys(s, {
          gf: casa ? hg : ag,
          gc: casa ? ag : hg,
          ours: fuerza(mio.id),
          rival: fuerza(casa ? f.away : f.home),
          oursDay: casa ? fh - 2 : fa,
          rivalDay: casa ? fa : fh - 2,
          home: casa,
          rivalStyle: casa ? sa : sh,
          xi: once(mio.id).xi,
        });
        s.lastReport = rep;
        recordMatch(s, rep, once(mio.id).xi);
        // moral y afición reaccionan a nuestro resultado
        const gf = casa ? hg : ag;
        const gc = casa ? ag : hg;
        moraleAfterMatch(s, gf, gc);
        conflictAfterMatch(
          s,
          once(mio.id).xi.map((p) => p.id),
          (d) => changeMorale(s, d),
          (title, body) => addMessage(s, { from: 'club', title, body }),
        );
        satisfactionAfterMatch(s, gf, gc, casa);
        coachAfterMatch(s, gf, gc);
      }
      // el partido cansa (después de las claves, que cuentan cómo llegaban)
      tire(s, [...once(f.home).xi, ...once(f.away).xi]);
      // lesiones de los titulares de ambos equipos
      for (const id of [f.home, f.away]) {
        const nuevas = rollInjuries(s, once(id).xi, id);
        if (id !== mio.id || !nuevas.length) continue;
        for (const p of nuevas) {
          s.lastReport?.events.push({ min: randInt(15, 88), side: f.home === mio.id ? 'home' : 'away', type: 'lesion', player: `${p.name} (${p.injury} j.)` });
          addMessage(s, {
            from: 'club',
            title: `🤕 ${p.name} se lesiona`,
            body: `${injuryName(p.injury!)}: estará ${p.injury} jornada(s) de baja.`,
          });
        }
      }
      if (d === mio.division) s.lastResults.push(r);
      // la afición crece o baja con los resultados
      for (const id of [f.home, f.away]) {
        const t = teamById(s, id)!;
        const gf = id === f.home ? hg : ag;
        const gc = id === f.home ? ag : hg;
        const factor = gf > gc ? 1.012 : gf < gc ? 0.992 : 1.002;
        t.fans = Math.max(100, Math.round(t.fans * factor));
      }
    }
    s.leagueStats.bestXI[d] = { matchday: md + 1, xi: bestXIOf(informes[d]) };
  }

  // ingresos y gastos fijos repartidos por jornada
  const c = s.club;
  const tv = Math.round(DIV_TV[mio.division] / MATCHDAYS);
  const patro = Math.round(sponsorFor(s) / MATCHDAYS);
  const sal = Math.round(wageBill(s) / MATCHDAYS);
  const dd = c.director ? Math.round(c.director.salary / MATCHDAYS) : 0;
  const mant = Math.round(maintenancePerSeason(s) / MATCHDAYS);
  const pers = Math.round(staffWages(s) / MATCHDAYS);
  const comp = Math.round(competitionPerMatchday(mio.division));
  c.cash += tv + patro - sal - dd - mant - pers - comp;
  c.ledger.competicion += comp;
  c.ledger.mantenimiento += mant;
  c.ledger.personal += pers;
  payLoans(s);

  // prima del patrocinador por victoria
  const nuestro = s.fixtures[mio.division][md].find((f) => f.home === mio.id || f.away === mio.id);
  const prima = sponsorPerWin(s);
  if (nuestro && prima) {
    const gana = nuestro.home === mio.id ? nuestro.hg! > nuestro.ag! : nuestro.ag! > nuestro.hg!;
    if (gana) { c.cash += prima; c.ledger.patrocinio += prima; }
  }
  c.ledger.tv += tv;
  c.ledger.patrocinio += patro;
  c.ledger.salarios += sal;
  c.ledger.director += dd;

  if (c.works) {
    c.works.matchdaysLeft--;
    if (c.works.matchdaysLeft <= 0) finishWorks(s);
  }

  healOneMatchday(s, lesionadosAntes);
  recoverAll(s);
  s.matchday++;
  c.cashLog.push(c.cash);

  // avisos de calendario
  if (s.matchday === MATCHDAYS - 10) announceRetirements(s);
  if (s.matchday === 18) {
    addMessage(s, { from: 'liga', title: 'Se abre el mercado de invierno', body: 'Podrás fichar y vender durante las próximas 3 jornadas.' });
  }
  if (s.matchday === 21) {
    addMessage(s, { from: 'liga', title: 'Se cierra el mercado de invierno', body: 'No habrá más fichajes hasta la pretemporada.' });
  }
  if (s.matchday === 28 && levelOf(s, 'renovaciones') === 'manual') {
    const acaban = mySquad(s).filter((p) => p.contract === 1);
    if (acaban.length) {
      addMessage(s, {
        from: 'club',
        title: `${acaban.length} contrato(s) terminan esta temporada`,
        body: acaban.map((p) => `• ${p.name} (${p.pos}, ${p.ovr}, ${p.age} años)`).join('\n') +
          '\n\nSi no los renuevas desde Plantilla, se irán libres al acabar la liga.',
      });
    }
  }

  // ofertas por nuestros jugadores durante el mercado de invierno
  // las negociaciones avanzan cada jornada; en el parón de invierno además llegan ofertas
  // y se hace efectivo lo acordado mientras el mercado estaba cerrado
  if (s.matchday === 18) executeAgreed(s);
  tickNegotiations(s);
  if (marketOpen(s)) {
    aiTransfers(s);
    generateOffers(s, 1);
  }
  runDirector(s, 'jornada');
  expireProposals(s);
  if (s.matchday < MATCHDAYS) maybeCreateEvent(s);

  if (c.satisfaction <= 5) {
    s.gameOver = 'Los socios, hartos de la gestión, han reunido las firmas necesarias y te obligan a vender el club.';
    return;
  }
  if (c.cash < -creditLimit(s)) {
    s.gameOver = `La deuda (${fmtMoney(-c.cash)}) supera el límite que aceptan los bancos (${fmtMoney(creditLimit(s))}). El club entra en concurso de acreedores.`;
    return;
  }
  if (c.cash < 0 && s.matchday % 5 === 0) {
    addMessage(s, {
      from: 'club',
      title: 'Estamos en números rojos',
      body: `Caja: ${fmtMoney(c.cash)}. Si la deuda pasa de ${fmtMoney(creditLimit(s))}, el club quiebra. Vende jugadores, baja salarios o sube ingresos.`,
    });
  }

  if (s.matchday >= MATCHDAYS) {
    s.phase = 'fin';
    const tabla = computeStandings(s.teams.filter((t) => t.division === mio.division).map((t) => t.id), s.fixtures[mio.division]);
    const pos = tabla.findIndex((x) => x.teamId === mio.id) + 1;
    const enPlayoff = mio.division > 0 && pos >= PLAYOFF_FROM && pos <= PLAYOFF_TO;
    addMessage(s, {
      from: 'liga',
      title: `Fin de liga: acabamos ${pos}º`,
      body: pos <= DIRECT_UP && mio.division > 0
        ? '¡Ascenso directo! Cierra la temporada para pasar a la siguiente.'
        : enPlayoff
          ? `Nos jugamos el ascenso en el playoff (del ${PLAYOFF_FROM}º al ${PLAYOFF_TO}º). Juégalo desde Inicio.`
          : pos > 20 - PROMOTE && mio.division < DIVISIONS - 1
            ? 'Descendemos. Toca reconstruir.'
            : 'Cierra la temporada para pasar a la pretemporada.',
    });
    startPlayoffs(s);
  }
}

function finishWorks(s: GameState) {
  const w = s.club.works!;
  if (w.kind === 'estadio') {
    s.club.capacity += w.amount;
    changeSatisfaction(s, 2, 'Estadio ampliado');
    addMessage(s, { from: 'club', title: 'Obras del estadio terminadas', body: `Nuevo aforo de «${s.club.identity.stadium}»: ${s.club.capacity.toLocaleString('es-ES')} espectadores.` });
  }
  s.club.works = null;
  // con gradas nuevas, el nombre del estadio ya se puede patrocinar
  refreshSponsorOffers(s);
}

/** Evolución de un jugador al cambiar de temporada */
/** "↑ Ana (+3), Luis (+2) · ↓ Pepe (−4)": los que más suben y bajan */
function resumenEvolucion(ev: { name: string; d: number }[]) {
  const fmt = (x: { name: string; d: number }) => `${x.name} (${x.d > 0 ? '+' : '−'}${Math.abs(x.d)})`;
  const suben = ev.filter((x) => x.d > 0).sort((a, b) => b.d - a.d).slice(0, 3);
  const bajan = ev.filter((x) => x.d < 0).sort((a, b) => a.d - b.d).slice(0, 3);
  return [suben.length ? `↑ ${suben.map(fmt).join(', ')}` : '', bajan.length ? `↓ ${bajan.map(fmt).join(', ')}` : ''].filter(Boolean).join(' · ');
}

export function endSeason(s: GameState) {
  if (s.phase !== 'fin') return;
  // partidas guardadas antes de existir el playoff: se monta ahora
  if (!s.playoffs) startPlayoffs(s);
  if (myPlayoffDue(s)) return 'Antes, juega el playoff de ascenso.';
  finishPlayoffs(s);
  const mio = myTeam(s);
  const divAntes = mio.division;

  // 1. clasificaciones, ascensos y descensos
  const movimientos: { team: Team; to: number }[] = [];
  let miPos = 0;
  let miFila: Standing | undefined;
  let primera: number[] = [];
  // pichichi de nuestra liga (antes de que los equipos cambien de categoría)
  const pichichi = leaders(s, divAntes).goles[0];
  for (let d = 0; d < DIVISIONS; d++) {
    const ids = s.teams.filter((t) => t.division === d).map((t) => t.id);
    const tabla = computeStandings(ids, s.fixtures[d]);
    if (d === 0) primera = tabla.map((r) => r.teamId);
    tabla.forEach((row, i) => {
      const t = teamById(s, row.teamId)!;
      if (t.id === mio.id) {
        miPos = i + 1;
        miFila = row;
      }
      // suben los dos primeros y el ganador del playoff
      if (d > 0 && (i < DIRECT_UP || t.id === playoffWinner(s, d))) movimientos.push({ team: t, to: d - 1 });
      if (d < DIVISIONS - 1 && i >= tabla.length - PROMOTE) movimientos.push({ team: t, to: d + 1 });
    });
  }
  s.playoffs = undefined;
  s.history.push({ season: s.season, division: divAntes, position: miPos });
  for (const m of movimientos) {
    const sube = m.to < m.team.division;
    m.team.division = m.to;
    m.team.fans = Math.round(m.team.fans * (sube ? 1.35 : 0.8));
  }
  // la temporada pasa a la historia del club (y los títulos, a la sala de trofeos)
  recordSeason(s, divAntes, mio.division, miPos, miFila);
  promotionClauses(s, divAntes, mio.division);
  if (pichichi) {
    const ultima = s.club.records.seasons.at(-1)!;
    ultima.leagueTopScorer = { name: pichichi.name, goals: pichichi.goals, ours: pichichi.t === mio.id };
    if (pichichi.t === mio.id) {
      addMessage(s, { from: 'liga', title: `👟 ${pichichi.name}, pichichi de la liga`, body: `${pichichi.goals} goles: el máximo goleador de ${DIVISION_NAMES[divAntes]} es nuestro.` });
    }
  }
  s.leagueStats = emptyStats(s.season + 1);
  // la afición tiende a la media de su categoría
  for (const t of s.teams) t.fans = Math.round(t.fans * 0.85 + DIV_FANS[t.division] * 0.15 * rand(0.7, 1.3));
  resetYellows(s);
  // los demás clubes amplían estadio e instalaciones según su nueva categoría
  growFacilities(s);
  mio.fans = Math.round(mio.fans * fansGrowthBonus(s) * marketingFansBonus(s) * fansGrowthSatisfaction(s) * seasonTicketFansGrowth(s));
  const objetivoFallado = Boolean(s.club.objective) && !objectiveMet(s.club.objective!, divAntes, miPos, mio.division);
  const fuerzanVenta = satisfactionEndSeason(s, miPos, divAntes, mio.division);
  resetSeasonMorale(s);
  coachEndSeason(s);
  newIdols(s, (title, body) => addMessage(s, { from: 'club', title, body }));

  // los cedidos vuelven a casa antes de repasar contratos
  returnLoans(s);

  // 2. jugadores: edad, evolución, retiradas y contratos
  const seVan: Player[] = [];
  const retirados: Player[] = [];
  const evolucion: { name: string; d: number }[] = [];
  announceRetirements(s); // por si no se hizo durante la liga
  s.players = s.players.filter((p) => {
    const esMio = p.teamId === mio.id;
    // los nuestros avisan antes; el resto decide ahora
    if (esMio ? p.retiring : chance(retireChance(p))) {
      if (esMio) retirados.push(p);
      return false;
    }
    const antes = p.ovr;
    develop(p, esMio ? s.club.training : 2.5, esMio ? agingFactor(s) * staffAgingFactor(s) : 1, esMio ? youthGrowthBonus(s) : 1);
    if (esMio && !p.youth && p.ovr !== antes) evolucion.push({ name: p.name, d: p.ovr - antes });
    if (p.teamId === null) return p.age < 34 || chance(0.3);
    p.contract--;
    if (p.contract <= 0) {
      if (esMio) {
        seVan.push(p);
        p.teamId = null;
      } else if (chance(0.7)) {
        p.contract = randInt(1, 3);
      } else {
        p.teamId = null;
      }
    }
    return true;
  });

  // 3. plantillas de la IA: se adaptan a su nueva categoría
  for (const t of s.teams) {
    if (t.id === mio.id) continue;
    const plantilla = s.players.filter((p) => p.teamId === t.id).sort((a, b) => a.ovr - b.ovr);
    const nivel = DIV_LEVEL[t.division];
    // los equipos que han cambiado de categoría renuevan a sus 4 peores (o mejores si bajan)
    const media = plantilla.reduce((a, p) => a + p.ovr, 0) / Math.max(1, plantilla.length);
    const cambios = Math.abs(media - nivel) > 4 ? 5 : 2;
    for (let i = 0; i < cambios && plantilla.length; i++) {
      const fuera = media < nivel ? plantilla.shift()! : plantilla.pop()!;
      fuera.teamId = null;
    }
    const restantes = s.players.filter((p) => p.teamId === t.id);
    const faltan = SQUAD_TARGET - restantes.length;
    for (let i = 0; i < faltan; i++) {
      const pos = (['POR', 'DEF', 'DEF', 'MED', 'MED', 'DEL'] as const)[i % 6];
      s.players.push(makePlayer(s, nivel + rand(-2, 2), { teamId: t.id, pos, contract: randInt(1, 4) }));
    }
  }
  // si algún club se ha quedado sin portero, se le da uno
  for (const t of s.teams) {
    if (t.id === mio.id) continue;
    if (!s.players.some((p) => p.teamId === t.id && p.pos === 'POR')) {
      s.players.push(makePlayer(s, DIV_LEVEL[t.division], { teamId: t.id, pos: 'POR' }));
    }
  }

  // 4. agentes libres: se limita la bolsa y se añaden nuevos
  const libres = s.players.filter((p) => p.teamId === null).sort((a, b) => b.ovr - a.ovr);
  const sobran = new Set(libres.slice(260).map((p) => p.id));
  s.players = s.players.filter((p) => !sobran.has(p.id));
  for (let i = 0; i < 60; i++) {
    s.players.push(makePlayer(s, DIV_LEVEL[randInt(0, DIVISIONS - 1)] - 3, { contract: 0 }));
  }

  // 5. cantera del club
  const nivelCantera = DIV_LEVEL[mio.division] - 14 + s.club.academy * 2.5;
  const canteranos: Player[] = [];
  // sin residencia de cantera llegan menos chavales
  const nuevos = s.club.academy === 0 ? randInt(1, 2) : randInt(3, 5);
  for (let i = 0; i < nuevos; i++) {
    const y = makePlayer(s, nivelCantera, { teamId: mio.id, age: randInt(16, 18), youth: true, contract: 0 });
    y.pot = clamp(Math.round(y.ovr + rand(6, 14) + s.club.academy * 3), y.ovr, 95);
    y.salary = roundMoney(y.salary * 0.5);
    canteranos.push(y);
    s.players.push(y);
  }

  // 6. economía y nueva temporada
  payDividends(s);
  seasonFinances(s, divAntes, objetivoFallado);
  const l = s.club.ledger;
  s.club.lastLedger = l;
  s.club.seasonLog.push({ season: s.season, division: divAntes, ledger: l, cashEnd: s.club.cash });
  s.club.ledger = emptyLedger();
  s.club.cashLog = [s.club.cash];
  if (s.club.works) finishWorks(s);
  s.season++;
  s.matchday = 0;
  s.phase = 'pretemporada';
  s.fixtures = buildAllFixtures(s);
  s.directorsMarket = makeDirectors(s, mio.division);
  // Supercopa y Copa de Campeones con lo que pasó la temporada pasada
  const finalCopa = s.cup.rounds.at(-1)?.[0];
  const copaFinalista = finalCopa && s.cup.champion !== undefined ? (finalCopa.a === s.cup.champion ? finalCopa.b : finalCopa.a) : undefined;
  const copaCampeon = s.cup.champion;
  s.cup = newCup(s);
  newSupercopa(s, primera[0], primera[1], copaCampeon, copaFinalista);
  newContinental(s, primera.slice(0, 4));
  scoutingNewSeason(s);
  seasonTicketsNewSeason(s, mio.division !== divAntes);
  refreshInvestorOffers(s);
  s.staffMarket = makeStaffCandidates(s, mio.division);
  farewells(s, retirados);
  s.pendingEvent = undefined;
  sponsorsEndSeason(s);
  scoutDiscoveries(s, () => {
    const p = makePlayer(s, DIV_LEVEL[mio.division] - 6, { age: randInt(17, 20), contract: 0 });
    p.pot = clamp(p.ovr + randInt(14, 24), p.ovr, 95);
    s.players.push(p);
    markKnown(s, p.id); // de los descubiertos ya tenemos informe
    return { name: p.name, pos: p.pos, pot: p.pot };
  });
  s.lastResults = [];

  const cambio = mio.division < divAntes ? `¡Subimos a ${DIVISION_NAMES[mio.division]}!`
    : mio.division > divAntes ? `Bajamos a ${DIVISION_NAMES[mio.division]}.`
    : `Seguimos en ${DIVISION_NAMES[mio.division]}.`;
  addMessage(s, {
    from: 'club',
    title: `Resumen de la temporada ${s.season - 1}`,
    body:
      `Acabamos ${miPos}º. ${cambio}\n\n` +
      `Ingresos: ${fmtMoney(ledgerIncome(l))} · Gastos: ${fmtMoney(ledgerExpense(l))} · Resultado: ${fmtMoney(ledgerIncome(l) - ledgerExpense(l))}\n` +
      (seVan.length ? `\nSe van libres: ${seVan.map((p) => p.name).join(', ')}.` : '') +
      (retirados.length ? `\nSe retiran: ${retirados.map((p) => p.name).join(', ')}.` : '') +
      (evolucion.length ? `\n\nEvolución de la plantilla: ${resumenEvolucion(evolucion)}` : '') +
      `\n\nLlegan ${canteranos.length} juveniles de la cantera. ` +
      (levelOf(s, 'cantera') === 'manual' ? 'Decide en Plantilla a quién subes antes de empezar la liga.' : 'El director deportivo los está valorando.'),
  });

  if (fuerzanVenta) {
    s.gameOver = 'Tras una temporada decepcionante, los socios han votado en asamblea y te obligan a vender el club.';
    return;
  }
  s.preWeek = 0;
  // abre el mercado de verano: llega lo acordado durante la temporada
  executeAgreed(s);
  generateOffers(s, 2);
  runDirector(s, 'pretemporada');
  fansExpectationMessage(s);
}
