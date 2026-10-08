import { fansExpectationMessage } from './fans';
import { ensureFacilities } from './rivals';
import { emptyStats } from './stats';
import { rollIdentity } from './traits';
import {
  DIV_FANS, DIV_LEVEL, DIV_PRICE, DIVISIONS, TEAMS_PER_DIV, emptyLedger, fairSalary,
} from './economy';
import { roundRobin } from './match';
import { clubName, personName, shortName, townNames } from './names';
import { clamp, gauss, pick, rand, randInt } from './rng';
import { STANDING, newLand } from './land';
import { DIRECTOR_PAY, candidateStars, clubMaxStars, makeStaffCandidates, maxStarsFor } from './staff';
import { refreshSponsorOffers } from './sponsor';
import { newCup } from './cup';
import { defaultSeasonTickets } from './tickets';
import { emptyBank, refreshInvestorOffers } from './bank';
import { emptyRecords } from './history';
import { defaultIdentity, ownerTitle, type Identity } from './identity';
import type { Level, Task } from './types';
import { STYLE_LABEL, runDirector } from './director';
import { addMessage } from './market';
import type { DDStyle, Director, GameState, Player, Pos, Team } from './types';

export const SAVE_VERSION = 1;

/** Reparto de posiciones en una plantilla de 22 */
export const PLANTILLA: Pos[] = [
  'POR', 'POR', 'POR',
  'DEF', 'DEF', 'DEF', 'DEF', 'DEF', 'DEF', 'DEF',
  'MED', 'MED', 'MED', 'MED', 'MED', 'MED', 'MED',
  'DEL', 'DEL', 'DEL', 'DEL', 'DEL',
];

export function newId(s: GameState) {
  return s.nextId++;
}

export function makePlayer(s: GameState, level: number, opts: Partial<Player> = {}): Player {
  const age = opts.age ?? randInt(18, 34);
  const ovr = clamp(Math.round(opts.ovr ?? gauss(level, 4.5)), 20, 95);
  // los jóvenes tienen más margen de mejora
  const margen = age <= 21 ? rand(4, 18) : age <= 25 ? rand(1, 9) : 0;
  const pot = clamp(Math.round(opts.pot ?? ovr + margen), ovr, 97);
  const p: Player = {
    id: newId(s),
    name: personName(),
    pos: opts.pos ?? pick(PLANTILLA),
    age,
    ovr,
    pot,
    salary: 0,
    contract: opts.contract ?? randInt(1, 4),
    teamId: opts.teamId ?? null,
    youth: opts.youth,
  };
  p.salary = opts.salary ?? Math.round(fairSalary(p) * rand(0.85, 1.15) / 100) * 100;
  rollIdentity(p);
  return p;
}

export function makeSquad(s: GameState, teamId: number, level: number) {
  for (const pos of PLANTILLA) s.players.push(makePlayer(s, level, { pos, teamId }));
}

const ESTILOS: DDStyle[] = ['equilibrado', 'ahorrador', 'cantera', 'estrellas'];

export function makeDirectors(s: GameState, division: number): Director[] {
  // el sueldo depende de su calidad; quién acepta venir, del prestigio del club
  const max = s.club ? clubMaxStars(s) : maxStarsFor(division);
  return candidateStars(6, max).map((stars) => ({
    id: newId(s),
    name: personName(),
    stars,
    style: pick(ESTILOS),
    salary: Math.round((DIRECTOR_PAY[stars - 1] * rand(0.9, 1.1)) / 1000) * 1000,
    contract: randInt(2, 3),
  }));
}

export interface NewGameOptions {
  stadium?: { x: number; y: number };
  director?: Director;
  delegation?: Level;
}

export function newGame(clubNameInput: string, identityInput?: Identity, opts: NewGameOptions = {}): GameState {
  const stadiumPos = opts.stadium;
  const s: GameState = {
    version: SAVE_VERSION,
    season: 1,
    phase: 'pretemporada',
    matchday: 0,
    teams: [],
    players: [],
    fixtures: [],
    club: null as unknown as GameState['club'],
    directorsMarket: [],
    staffMarket: {} as GameState['staffMarket'],
    sponsorOffers: {},
    negotiations: [],
    preWeek: 0,
    leagueStats: emptyStats(1),
    cup: null as unknown as GameState['cup'],
    messages: [],
    history: [],
    lastResults: [],
    nextId: 1,
  };

  const pueblos = townNames(DIVISIONS * TEAMS_PER_DIV);
  let t = 0;
  for (let d = 0; d < DIVISIONS; d++) {
    for (let i = 0; i < TEAMS_PER_DIV; i++) {
      const pueblo = pueblos[t++];
      const team: Team = {
        id: newId(s),
        name: clubName(pueblo),
        short: shortName(pueblo),
        division: d,
        fans: Math.round(DIV_FANS[d] * rand(0.6, 1.6)),
      };
      s.teams.push(team);
      // cada club con un nivel algo distinto dentro de su división
      makeSquad(s, team.id, DIV_LEVEL[d] + rand(-3, 3));
    }
  }

  // el club del jugador: el último de la división más baja, algo por debajo de la media
  const ultima = DIVISIONS - 1;
  const mio = s.teams.filter((x) => x.division === ultima)[0];
  const nombre = clubNameInput.trim() || 'CD Fowner';
  mio.name = nombre;
  mio.short = nombre.replace(/^(CD|UD|SD|CF|Atlético|Racing|Real Club|Sporting|Unión|Deportivo)\s+/i, '').slice(0, 3).toUpperCase();
  mio.fans = DIV_FANS[ultima];
  s.players = s.players.filter((p) => p.teamId !== mio.id);
  makeSquad(s, mio.id, DIV_LEVEL[ultima] - 1);

  const identity = identityInput ?? defaultIdentity(nombre);
  s.club = {
    teamId: mio.id,
    identity,
    cash: 180_000,
    ticketPrice: DIV_PRICE[ultima],
    seasonTickets: { price: 0, maxShare: 0.5, sold: 0 },
    bank: emptyBank(),
    capacity: STANDING, // sin gradas: la gente ve el partido de pie
    training: 0, // sin ciudad deportiva al empezar
    academy: 0, // sin cantera al empezar
    director: null,
    delegation: { fichajes: 'manual', ventas: 'manual', renovaciones: 'manual', cantera: 'manual', empleados: 'manual' },
    transferBudget: 40_000,
    wageCap: 170_000,
    staffBudget: 25_000,
    works: null,
    ledger: emptyLedger(),
    lastLedger: null,
    land: newLand(stadiumPos),
    satisfaction: 60,
    morale: 55,
    satLog: [],
    trophies: [],
    records: emptyRecords(),
    staff: {},
    sponsors: {},
    cashLog: [180_000],
    seasonLog: [],
  };

  // agentes libres iniciales
  for (let i = 0; i < 120; i++) {
    const d = randInt(0, DIVISIONS - 1);
    s.players.push(makePlayer(s, DIV_LEVEL[d] - 3, { contract: 0 }));
  }

  ensureFacilities(s.teams.filter((t) => t.id !== s.club.teamId));
  s.fixtures = buildAllFixtures(s);
  s.directorsMarket = makeDirectors(s, ultima);
  s.staffMarket = makeStaffCandidates(s, ultima);
  s.cup = newCup(s);
  s.club.seasonTickets = defaultSeasonTickets(s);
  refreshInvestorOffers(s);
  refreshSponsorOffers(s);

  s.messages.push({
    id: newId(s),
    season: 1,
    matchday: 0,
    from: 'club',
    title: `¡Bienvenido, ${ownerTitle(identity)}!`,
    body:
      `Acabas de comprar el ${nombre}. Jugamos en «${identity.stadium}», estamos en la Liga Comarcal y la caja está justa.\n\n` +
      'De momento solo tenemos el campo: no hay gradas y caben unas 600 personas de pie. ' +
      'En Instalaciones puedes construir gradas, comprar terreno y levantar nuevas instalaciones.\n\n' +
      'Puedes llevarlo todo tú o contratar un director deportivo (Dirección) y decidir qué tareas le delegas: ' +
      'fichajes, ventas, renovaciones y cantera. Cada una puede estar en Manual, Propone y apruebas, o Automático.\n\n' +
      'En Inicio te guiamos paso a paso por la pretemporada: patrocinador, objetivo y entrenador.',
    read: false,
  });
  // la primera semana es tranquila: las ofertas por nuestros jugadores empiezan a llegar en la segunda
  fansExpectationMessage(s);
  s.introPending = true;

  // director deportivo elegido al crear la partida
  if (opts.director) {
    const d = { ...opts.director, id: newId(s) };
    s.club.director = d;
    for (const t of Object.keys(s.club.delegation) as Task[]) s.club.delegation[t] = opts.delegation ?? 'propone';
    addMessage(s, {
      from: 'director',
      title: `${d.name} se incorpora como director deportivo`,
      body: `Encantado, ${ownerTitle(identity)}. Mi estilo: ${STYLE_LABEL[d.style].toLowerCase()}. ` +
        'Ya estoy trabajando en lo que me has encargado; puedes cambiarlo cuando quieras en Dirección.',
    });
    runDirector(s, 'cambio');
  }
  return s;
}

export function buildAllFixtures(s: GameState) {
  const out = [];
  for (let d = 0; d < DIVISIONS; d++) {
    out.push(roundRobin(s.teams.filter((t) => t.division === d).map((t) => t.id)));
  }
  return out;
}
