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
  signedSeason?: number; // temporada en la que llegó al club del jugador
}

export interface Team {
  id: number;
  name: string;
  short: string;
  division: number; // 0 = Primera ... 4 = la más baja
  fans: number;
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
export type Task = 'fichajes' | 'ventas' | 'renovaciones' | 'cantera';
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
  | { kind: 'cantera'; playerId: number };

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
}

export interface Club {
  teamId: number;
  cash: number;
  ticketPrice: number;
  capacity: number;
  training: number; // nivel 1-5
  academy: number; // nivel 1-5
  director: Director | null;
  delegation: Record<Task, Level>;
  transferBudget: number; // presupuesto que el dueño concede al DD para fichajes
  wageCap: number; // tope de masa salarial anual que el DD debe respetar
  works: { kind: 'estadio' | 'training' | 'academy'; matchdaysLeft: number; amount: number } | null;
  ledger: Ledger; // temporada actual
  lastLedger: Ledger | null;
}

export interface MatchResult {
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
  messages: Message[];
  history: { season: number; division: number; position: number }[];
  lastResults: MatchResult[]; // últimos resultados de la división del jugador
  gameOver?: string;
  nextId: number;
}
