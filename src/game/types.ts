import type { Identity } from './identity';
import type { Land } from './land';
import type { MatchReport } from './report';
import type { Role, Staff } from './staff';
import type { Profile, Trait } from './traits';
import type { LeagueStats } from './stats';
import type { Continental, Supercopa } from './continental';
import type { Negotiation } from './negotiation';
import type { SponsorContract, SponsorSlot } from './sponsor';
import type { PendingEvent } from './events';
import type { Objective } from './fans';
import type { Cup } from './cup';
import type { SeasonTickets } from './tickets';
import type { BankState } from './bank';
import type { Records } from './history';

export type Pos = 'POR' | 'DEF' | 'MED' | 'DEL';

export interface Player {
  id: number;
  name: string;
  pos: Pos;
  age: number;
  ovr: number; // media actual (1-99)
  pot: number; // techo de desarrollo
  salary: number; // € por temporada
  contract: number; // temporadas de contrato restantes (incluida la actual)
  teamId: number | null; // null = agente libre
  youth?: boolean; // canterano pendiente de decidir
  injury?: number; // jornadas que le quedan de baja
  form?: number[]; // últimas notas en partidos (como mucho 5, la más reciente al final)
  season?: { apps: number; goals: number; assists: number; ratingSum: number }; // esta temporada
  retiring?: boolean; // ha anunciado que se retira al acabar la temporada
  persuaded?: boolean; // ya se intentó convencerle de seguir
  profile?: Profile; // perfil de juego: decide cómo encaja en el sistema del entrenador
  traits?: Trait[]; // rasgos de personalidad
  adapt?: { coach: number; apps: number }; // partidos jugados con el entrenador actual (adaptación al sistema)
  loan?: { from: number; until: number; apps: number }; // cedido: club dueño, temporada en que vuelve y partidos jugados
  valueStart?: number; // valor de mercado al empezar la temporada (para ver si se revaloriza)
  listed?: boolean; // transferible: lo ofrecemos a otros clubes
  fatigue?: number; // cansancio acumulado, 0 = fresco (la condición física es 100 - cansancio)
  potHidden?: number; // promesa oculta: potencial extra que solo descubre un informe de los ojeadores
  signedSeason?: number; // temporada en la que llegó al club del jugador
}

export interface Team {
  id: number;
  name: string;
  short: string;
  division: number; // 0 = Primera ... 4 = la más baja
  fans: number;
  country?: string; // solo clubes extranjeros (Copa de Campeones)
  fac?: import('./rivals').RivalFacilities; // estadio y edificios (los rivales)
}

export interface Fixture {
  home: number;
  away: number;
  hg?: number;
  ag?: number;
}

export interface Standing {
  teamId: number;
  pj: number;
  g: number;
  e: number;
  p: number;
  gf: number;
  gc: number;
  pts: number;
}

/** Tareas deportivas que puede asumir el director deportivo */
export type Task = 'fichajes' | 'ventas' | 'renovaciones' | 'cantera' | 'empleados';
export type Level = 'manual' | 'propone' | 'auto';

export type DDStyle = 'equilibrado' | 'ahorrador' | 'cantera' | 'estrellas';

export interface Director {
  id: number;
  name: string;
  stars: number; // 1-5
  style: DDStyle;
  salary: number; // € por temporada
}

export type Proposal =
  | { kind: 'fichar'; playerId: number; fee: number; salary: number; years: number }
  | { kind: 'vender'; playerId: number; fee: number; toTeamId: number }
  | { kind: 'renovar'; playerId: number; salary: number; years: number }
  | { kind: 'cantera'; playerId: number }
  | { kind: 'empleado'; role: Role; staffId: number; playerId?: undefined };

export interface Message {
  id: number;
  season: number;
  matchday: number;
  from: 'director' | 'club' | 'liga' | 'prensa';
  title: string;
  body: string;
  proposal?: Proposal;
  status?: 'pendiente' | 'aprobada' | 'rechazada' | 'caducada';
  read: boolean;
}

export interface Ledger {
  taquilla: number;
  tv: number;
  patrocinio: number;
  traspasosIn: number; // ingresos por ventas
  traspasosOut: number; // gastos en fichajes
  salarios: number;
  director: number;
  obras: number;
  comercial: number; // tienda y bar
  mantenimiento: number; // instalaciones
  personal: number; // empleados, multas y otros gastos
  copa: number; // premios de Copa
  abonos: number; // campaña de abonos
  financiacion: number; // dinero recibido de préstamos e inversores
  cuotas: number; // capital devuelto de préstamos
  intereses: number; // intereses y comisiones de préstamos
  inversores: number; // reparto de beneficios y recompras a inversores
  competicion: number; // desplazamientos, arbitrajes, seguridad y licencias
  multas: number; // multas de la liga
  impuestos: number; // impuesto sobre beneficios
}

export interface Club {
  teamId: number;
  identity: Identity;
  cash: number;
  ticketPrice: number;
  seasonTickets: SeasonTickets;
  bank: BankState;
  capacity: number;
  training: number; // nivel 1-5
  academy: number; // nivel 1-5
  director: Director | null;
  delegation: Record<Task, Level>;
  transferBudget: number; // presupuesto que el dueño concede al DD para fichajes
  wageCap: number; // tope de masa salarial anual que el DD debe respetar
  staffBudget: number; // tope de sueldos de empleados que el DD debe respetar
  works: { kind: 'estadio' | 'training' | 'academy'; matchdaysLeft: number; amount: number } | null;
  ledger: Ledger; // temporada actual
  lastLedger: Ledger | null;
  land: Land;
  satisfaction: number; // satisfacción de la afición, 0-100
  morale: number; // moral del vestuario, 0-100
  objective?: Objective; // objetivo de la temporada en curso
  satLog: { season: number; matchday: number; delta: number; text: string }[];
  trophies: { season: number; name: string }[];
  records: Records;
  retireCheck?: number; // temporada en la que los veteranos ya decidieron si se retiran
  scouted?: number[]; // jugadores de otros clubes con informe de los ojeadores
  reportsUsed?: number; // informes pedidos esta temporada
  transferBan?: number; // temporada en la que no se pueden pagar traspasos (sanción por deuda)
  staff: Partial<Record<Role, Staff>>;
  sponsors: Partial<Record<SponsorSlot, SponsorContract>>;
  cashLog: number[]; // caja al empezar la temporada y tras cada jornada
  seasonLog: { season: number; division: number; ledger: Ledger; cashEnd: number }[];
}

export interface MatchResult {
  abonados?: number;
  home: number;
  away: number;
  hg: number;
  ag: number;
  attendance?: number;
}

export interface GameState {
  version: number;
  season: number; // 1, 2, 3...
  phase: 'pretemporada' | 'temporada' | 'fin';
  matchday: number; // jornadas jugadas (0-38)
  teams: Team[];
  players: Player[];
  fixtures: Fixture[][][]; // [división][jornada][partido]
  club: Club;
  directorsMarket: Director[];
  staffMarket: Record<Role, Staff[]>;
  sponsorOffers: Partial<Record<SponsorSlot, SponsorContract[]>>;
  pendingEvent?: PendingEvent;
  cup: Cup;
  negotiations: Negotiation[]; // fichajes, ventas y cesiones en marcha (y las últimas cerradas)
  playoffs?: import('./playoff').Playoff[]; // playoffs de ascenso de la temporada que acaba
  introPending?: boolean; // partida nueva: falta enseñar la bienvenida
  skipCoach?: number; // temporada en la que el dueño decidió seguir sin entrenador
  preWeek?: number; // semana de pretemporada (el mercado avanza por semanas)
  lastEventKey?: string;
  messages: Message[];
  history: { season: number; division: number; position: number }[];
  lastResults: MatchResult[]; // últimos resultados de la división del jugador
  lastReport?: MatchReport; // informe de nuestro último partido
  leagueStats: LeagueStats; // goleadores, asistentes y notas de la temporada
  supercopa?: Supercopa;
  continental?: Continental; // Copa de Campeones (solo si nos clasificamos)
  gameOver?: string;
  nextId: number;
}
