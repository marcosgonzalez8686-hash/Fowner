import { DIVISION_NAMES } from './economy';
import { SAVE_VERSION } from './generate';
import { emptyLedger } from './economy';
import { defaultIdentity, type Crest } from './identity';
import { newLand } from './land';
import { makeStaffCandidates } from './staff';
import { migrateSponsors } from './sponsor';
import { newCup } from './cup';
import { defaultSeasonTickets } from './tickets';
import type { GameState } from './types';

export const SLOTS = [1, 2, 3] as const;
export type Slot = (typeof SLOTS)[number];

/** Resumen ligero de cada partida para el menú, sin tener que leer la partida entera */
export interface SlotMeta {
  club: string;
  division: string;
  season: number;
  matchday: number;
  phase: GameState['phase'];
  cash: number;
  gameOver: boolean;
  savedAt: number;
  crest?: Crest;
}

const gameKey = (n: Slot) => `fowner-partida-${n}`;
const metaKey = (n: Slot) => `fowner-meta-${n}`;
const LEGACY_KEY = 'fowner-partida';

function metaOf(s: GameState): SlotMeta {
  const team = s.teams.find((t) => t.id === s.club.teamId)!;
  return {
    club: team.name,
    division: DIVISION_NAMES[team.division],
    season: s.season,
    matchday: s.matchday,
    phase: s.phase,
    cash: s.club.cash,
    gameOver: Boolean(s.gameOver),
    savedAt: Date.now(),
    crest: s.club.identity?.crest,
  };
}

/** La primera versión guardaba una sola partida: se pasa al hueco 1 */
function migrateLegacy() {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return;
    if (!localStorage.getItem(gameKey(1))) {
      const s = JSON.parse(raw) as GameState;
      if (s.version === SAVE_VERSION) {
        localStorage.setItem(gameKey(1), raw);
        localStorage.setItem(metaKey(1), JSON.stringify(metaOf(s)));
      }
    }
    localStorage.removeItem(LEGACY_KEY);
  } catch {
    // sin almacenamiento disponible
  }
}

export function listSlots(): { slot: Slot; meta: SlotMeta | null }[] {
  migrateLegacy();
  return SLOTS.map((slot) => {
    try {
      const raw = localStorage.getItem(metaKey(slot));
      return { slot, meta: raw ? (JSON.parse(raw) as SlotMeta) : null };
    } catch {
      return { slot, meta: null };
    }
  });
}

/** Completa partidas guardadas con versiones anteriores del juego */
function migrate(s: GameState) {
  const c = s.club;
  if (!c.identity) c.identity = defaultIdentity(s.teams.find((t) => t.id === c.teamId)?.name);
  if (!c.land) c.land = newLand();
  if (!c.cashLog) c.cashLog = [c.cash];
  if (!c.seasonLog) c.seasonLog = [];
  if (!c.staff) c.staff = {};
  if (c.satisfaction === undefined) c.satisfaction = 60;
  if (c.morale === undefined) c.morale = 55;
  if (!c.satLog) c.satLog = [];
  if (!c.trophies) c.trophies = [];
  if (!s.cup) s.cup = newCup(s);
  if (!c.seasonTickets) c.seasonTickets = defaultSeasonTickets(s);
  // partida a mitad de temporada sin objetivo: se le pone uno moderado
  if (s.phase !== 'pretemporada' && !c.objective) c.objective = 'mitad';
  if (c.staffBudget === undefined) c.staffBudget = 25_000;
  if (!c.delegation.empleados) c.delegation.empleados = 'manual';
  if (!s.staffMarket) s.staffMarket = makeStaffCandidates(s, s.teams.find((t) => t.id === c.teamId)!.division);
  migrateSponsors(s);
  c.ledger = { ...emptyLedger(), ...c.ledger };
  if (c.lastLedger) c.lastLedger = { ...emptyLedger(), ...c.lastLedger };
}

export function loadGame(slot: Slot): GameState | null {
  try {
    const raw = localStorage.getItem(gameKey(slot));
    if (!raw) return null;
    const s = JSON.parse(raw) as GameState;
    if (s.version !== SAVE_VERSION) return null;
    migrate(s);
    return s;
  } catch {
    return null;
  }
}

/** Devuelve false si no se pudo guardar (por ejemplo, almacenamiento lleno o modo privado) */
export function saveGame(slot: Slot, s: GameState): boolean {
  try {
    localStorage.setItem(gameKey(slot), JSON.stringify(s));
    localStorage.setItem(metaKey(slot), JSON.stringify(metaOf(s)));
    return true;
  } catch {
    return false;
  }
}

export function deleteGame(slot: Slot) {
  try {
    localStorage.removeItem(gameKey(slot));
    localStorage.removeItem(metaKey(slot));
  } catch {
    // nada que borrar
  }
}
