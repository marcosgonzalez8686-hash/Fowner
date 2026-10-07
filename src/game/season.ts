import {
  DIV_FANS, DIV_LEVEL, DIV_PRICE, DIV_SPONSOR, DIV_TV, DIVISION_NAMES, DIVISIONS, MATCHDAYS, PROMOTE,
  SQUAD_TARGET, emptyLedger, fmtMoney, ledgerExpense, ledgerIncome, roundMoney,
} from './economy';
import { expireProposals, levelOf, runDirector } from './director';
import { buildAllFixtures, makeDirectors, makePlayer } from './generate';
import { addMessage, myTeam, mySquad, myYouth, teamById, wageBill } from './market';
import { bestEleven, computeStandings, form, simulate } from './match';
import { chance, clamp, gauss, rand, randInt } from './rng';
import type { GameState, MatchResult, Player, Team } from './types';

export const creditLimit = (s: GameState) => {
  const d = myTeam(s).division;
  return roundMoney((DIV_TV[d] + DIV_SPONSOR[d]) * 0.5 + 40_000);
};

export const sponsorFor = (s: GameState) => {
  const t = myTeam(s);
  return roundMoney(DIV_SPONSOR[t.division] * clamp(0.6 + 0.4 * (t.fans / DIV_FANS[t.division]), 0.5, 2));
};

/** Asistencia esperada a un partido en casa */
export function expectedAttendance(s: GameState) {
  const t = myTeam(s);
  const ref = DIV_PRICE[t.division];
  const precio = clamp(1.6 - 0.6 * (s.club.ticketPrice / ref), 0.15, 1.6);
  const racha = form(t.id, s.fixtures[t.division]);
  const animo = 1 + racha.reduce((a, r) => a + (r === 'G' ? 0.04 : r === 'P' ? -0.04 : 0), 0);
  return Math.round(Math.min(s.club.capacity, t.fans * precio * animo));
}

export function startSeason(s: GameState) {
  if (s.phase !== 'pretemporada') return;
  // los juveniles sin decidir se van
  for (const y of myYouth(s)) { y.teamId = null; y.youth = false; }
  s.phase = 'temporada';
  expireProposals(s);
  addMessage(s, {
    from: 'liga',
    title: `Arranca la temporada ${s.season}`,
    body: `Jugamos en ${DIVISION_NAMES[myTeam(s).division]}. El mercado cierra hasta el parón de invierno (jornadas 19 a 21).`,
  });
}

export function playMatchday(s: GameState) {
  if (s.phase !== 'temporada' || s.gameOver) return;
  const porEquipo = new Map<number, Player[]>();
  for (const p of s.players) {
    if (p.teamId === null) continue;
    if (!porEquipo.has(p.teamId)) porEquipo.set(p.teamId, []);
    porEquipo.get(p.teamId)!.push(p);
  }
  const fuerza = (id: number) => bestEleven(porEquipo.get(id) ?? []).strength;
  const mio = myTeam(s);
  const md = s.matchday;
  s.lastResults = [];

  for (let d = 0; d < DIVISIONS; d++) {
    for (const f of s.fixtures[d][md]) {
      // pequeño factor anímico aleatorio por partido
      const { hg, ag } = simulate(fuerza(f.home) + 2 + gauss(0, 2), fuerza(f.away) + gauss(0, 2));
      f.hg = hg;
      f.ag = ag;
      const r: MatchResult = { home: f.home, away: f.away, hg, ag };
      if (f.home === mio.id) {
        r.attendance = expectedAttendance(s);
        const ingreso = r.attendance * s.club.ticketPrice;
        s.club.cash += ingreso;
        s.club.ledger.taquilla += ingreso;
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
  }

  // ingresos y gastos fijos repartidos por jornada
  const c = s.club;
  const tv = Math.round(DIV_TV[mio.division] / MATCHDAYS);
  const patro = Math.round(sponsorFor(s) / MATCHDAYS);
  const sal = Math.round(wageBill(s) / MATCHDAYS);
  const dd = c.director ? Math.round(c.director.salary / MATCHDAYS) : 0;
  c.cash += tv + patro - sal - dd;
  c.ledger.tv += tv;
  c.ledger.patrocinio += patro;
  c.ledger.salarios += sal;
  c.ledger.director += dd;

  if (c.works) {
    c.works.matchdaysLeft--;
    if (c.works.matchdaysLeft <= 0) finishWorks(s);
  }

  s.matchday++;

  // avisos de calendario
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

  runDirector(s, 'jornada');
  expireProposals(s);

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
    addMessage(s, {
      from: 'liga',
      title: `Fin de liga: acabamos ${pos}º`,
      body: pos <= PROMOTE && mio.division > 0
        ? '¡Ascenso! Cierra la temporada para pasar a la siguiente.'
        : pos > 20 - PROMOTE && mio.division < DIVISIONS - 1
          ? 'Descendemos. Toca reconstruir.'
          : 'Cierra la temporada para pasar a la pretemporada.',
    });
  }
}

function finishWorks(s: GameState) {
  const w = s.club.works!;
  if (w.kind === 'estadio') {
    s.club.capacity += w.amount;
    addMessage(s, { from: 'club', title: 'Obras del estadio terminadas', body: `Nuevo aforo: ${s.club.capacity.toLocaleString('es-ES')} espectadores.` });
  }
  s.club.works = null;
}

/** Evolución de un jugador al cambiar de temporada */
function develop(p: Player, training: number) {
  p.age++;
  if (p.age <= 24) {
    const crece = Math.max(0, p.pot - p.ovr) * rand(0.15, 0.4) * (0.75 + training * 0.1);
    p.ovr = Math.min(p.pot, Math.round(p.ovr + crece));
  } else if (p.age <= 29) {
    p.ovr = clamp(p.ovr + randInt(-1, 1), 20, p.pot);
  } else {
    p.ovr = Math.max(20, Math.round(p.ovr - rand(0, 2) - (p.age - 30) * 0.6));
  }
  p.pot = Math.max(p.pot, p.ovr);
}

export function endSeason(s: GameState) {
  if (s.phase !== 'fin') return;
  const mio = myTeam(s);
  const divAntes = mio.division;

  // 1. clasificaciones, ascensos y descensos
  const movimientos: { team: Team; to: number }[] = [];
  let miPos = 0;
  for (let d = 0; d < DIVISIONS; d++) {
    const ids = s.teams.filter((t) => t.division === d).map((t) => t.id);
    const tabla = computeStandings(ids, s.fixtures[d]);
    tabla.forEach((row, i) => {
      const t = teamById(s, row.teamId)!;
      if (t.id === mio.id) miPos = i + 1;
      if (d > 0 && i < PROMOTE) movimientos.push({ team: t, to: d - 1 });
      if (d < DIVISIONS - 1 && i >= tabla.length - PROMOTE) movimientos.push({ team: t, to: d + 1 });
    });
  }
  s.history.push({ season: s.season, division: divAntes, position: miPos });
  for (const m of movimientos) {
    const sube = m.to < m.team.division;
    m.team.division = m.to;
    m.team.fans = Math.round(m.team.fans * (sube ? 1.35 : 0.8));
  }
  // la afición tiende a la media de su categoría
  for (const t of s.teams) t.fans = Math.round(t.fans * 0.85 + DIV_FANS[t.division] * 0.15 * rand(0.7, 1.3));

  // 2. jugadores: edad, evolución, retiradas y contratos
  const seVan: Player[] = [];
  const retirados: Player[] = [];
  s.players = s.players.filter((p) => {
    const esMio = p.teamId === mio.id;
    develop(p, esMio ? s.club.training : 2.5);
    if (p.age >= 35 && chance(0.5 + (p.age - 35) * 0.2)) {
      if (esMio) retirados.push(p);
      return false;
    }
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
  for (let i = 0; i < randInt(3, 5); i++) {
    const y = makePlayer(s, nivelCantera, { teamId: mio.id, age: randInt(16, 18), youth: true, contract: 0 });
    y.pot = clamp(Math.round(y.ovr + rand(6, 14) + s.club.academy * 3), y.ovr, 95);
    y.salary = roundMoney(y.salary * 0.5);
    canteranos.push(y);
    s.players.push(y);
  }

  // 6. economía y nueva temporada
  const l = s.club.ledger;
  s.club.lastLedger = l;
  s.club.ledger = emptyLedger();
  if (s.club.works) finishWorks(s);
  s.season++;
  s.matchday = 0;
  s.phase = 'pretemporada';
  s.fixtures = buildAllFixtures(s);
  s.directorsMarket = makeDirectors(s, mio.division);
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
      `\n\nLlegan ${canteranos.length} juveniles de la cantera. ` +
      (levelOf(s, 'cantera') === 'manual' ? 'Decide en Plantilla a quién subes antes de empezar la liga.' : 'El director deportivo los está valorando.'),
  });

  runDirector(s, 'pretemporada');
}
