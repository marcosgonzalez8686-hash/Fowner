import LZString from 'lz-string';

const { compressToUTF16, decompressFromUTF16, compressToBase64, decompressFromBase64 } = LZString;
import { emptyStats } from './stats';
import { ensureFacilities } from './rivals';
import { createWorld } from './world';
import { quarterFinals } from './europe';
import { DIVISION_NAMES } from './economy';
import { SAVE_VERSION } from './generate';
import { emptyLedger } from './economy';
import { defaultIdentity, type Crest } from './identity';
import { claimFullSize, newLand } from './land';
import { makeStaffCandidates } from './staff';
import { ensureCoach } from './coach';
import { newSaleOffer } from './negotiation';
import { rollIdentity } from './traits';
import { bestEleven } from './match';
import { migrateSponsors } from './sponsor';
import { newCup } from './cup';
import { emptyRecords } from './history';
import { defaultSeasonTickets } from './tickets';
import { emptyBank, refreshInvestorOffers } from './bank';
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
  difficulty?: GameState['difficulty'];
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
    difficulty: s.difficulty ?? 'normal',
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
  // edificios grandes construidos antes de que ocupasen varias parcelas
  claimFullSize(s);
  if (!c.cashLog) c.cashLog = [c.cash];
  if (!c.seasonLog) c.seasonLog = [];
  if (!c.staff) c.staff = {};
  if (c.satisfaction === undefined) c.satisfaction = 60;
  if (c.morale === undefined) c.morale = 55;
  if (!c.satLog) c.satLog = [];
  if (!c.trophies) c.trophies = [];
  if (!c.records) {
    c.records = emptyRecords();
    // temporadas ya jugadas, con lo que se sabía de ellas
    c.records.seasons = s.history.map((h) => ({ season: h.season, division: h.division, position: h.position }));
  }
  if (!s.cup) s.cup = newCup(s);
  // las ofertas recibidas de antes pasan a ser negociaciones de venta
  if (!s.negotiations) {
    s.negotiations = [];
    const viejas = (s as unknown as { incomingOffers?: { playerId: number; teamId: number; fee: number; maxFee: number; wantsToLeave: boolean }[] }).incomingOffers ?? [];
    for (const o of viejas) {
      const p = s.players.find((x) => x.id === o.playerId);
      if (p) newSaleOffer(s, p, o.teamId, o.fee, o.maxFee, o.wantsToLeave);
    }
    delete (s as unknown as { incomingOffers?: unknown }).incomingOffers;
  }
  s.preWeek ??= 0;
  if (!s.leagueStats) s.leagueStats = emptyStats(s.season);
  if (!c.seasonTickets) c.seasonTickets = defaultSeasonTickets(s);
  if (!c.bank) {
    c.bank = emptyBank();
    refreshInvestorOffers(s);
  }
  // partida a mitad de temporada sin objetivo: se le pone uno moderado
  if (s.phase !== 'pretemporada' && !c.objective) c.objective = 'mitad';
  if (c.staffBudget === undefined) c.staffBudget = 25_000;
  if (!c.delegation.empleados) c.delegation.empleados = 'manual';
  if (!s.staffMarket) s.staffMarket = makeStaffCandidates(s, s.teams.find((t) => t.id === c.teamId)!.division);
  // entrenadores con sistema, estilo y contrato
  // (el que ya estaba sigue con el sistema que mejor le iba a la plantilla)
  if (c.staff.entrenador) ensureCoach(c.staff.entrenador, bestEleven(s.players.filter((p) => p.teamId === c.teamId)).formation);
  for (const e of s.staffMarket.entrenador ?? []) ensureCoach(e);
  // perfil de juego y rasgos para los jugadores de antes
  for (const p of s.players) rollIdentity(p);
  migrateSponsors(s);
  // contratos del director y los empleados (antes no tenían): conservan el sueldo y renuevan pronto
  if (c.director && c.director.contract === undefined) c.director.contract = 1 + Math.round(Math.random());
  for (const e of Object.values(c.staff)) if (e && e.contract === undefined) e.contract = 1 + Math.round(Math.random());
  // el resto del mundo (partidas de antes): nacionalidades y ligas extranjeras
  if (!s.world) {
    for (const p of s.players) p.nat ??= Math.random() < 0.88 ? 'ESP' : 'ARG';
    createWorld(s);
  }
  // la antigua Copa de Campeones da paso a las tres competiciones europeas (desde la temporada siguiente)
  delete s.continental;
  // eliminatorias europeas a ida y vuelta: las que iban a partido único se rehacen desde los cuartos
  if (s.europe && !s.europe.legs) {
    for (const comp of s.europe.comps) if (comp.stage >= 4) quarterFinals(comp);
    s.europe.legs = true;
  }
  // instalaciones de los rivales (partidas de antes)
  ensureFacilities(s.teams.filter((t) => t.id !== c.teamId));
  c.ledger = { ...emptyLedger(), ...c.ledger };
  if (c.lastLedger) c.lastLedger = { ...emptyLedger(), ...c.lastLedger };
}

/** Las partidas se guardan comprimidas; las antiguas, en JSON tal cual */
function parse(raw: string): GameState {
  return JSON.parse(raw.startsWith('{') ? raw : decompressFromUTF16(raw)) as GameState;
}

export function loadGame(slot: Slot): GameState | null {
  try {
    const raw = localStorage.getItem(gameKey(slot));
    if (!raw) return null;
    const s = parse(raw);
    if (s.version !== SAVE_VERSION) return null;
    migrate(s);
    return s;
  } catch {
    return null;
  }
}

// guardado en segundo plano: la compresión va en un worker y solo se escribe la última versión
let worker: Worker | null | undefined;
let seq = 0;
let onError: (() => void) | undefined;
/** Qué hacer si una partida no se puede guardar (almacenamiento lleno, modo privado...) */
export const onSaveError = (fn: () => void) => { onError = fn; };

function escribe(slot: Slot, data: string) {
  try {
    localStorage.setItem(gameKey(slot), data);
  } catch {
    onError?.();
  }
}

function getWorker() {
  if (worker !== undefined) return worker;
  try {
    worker = typeof Worker === 'undefined' ? null : new Worker(new URL('./saveWorker.ts', import.meta.url), { type: 'module' });
    worker?.addEventListener('message', (e: MessageEvent<{ slot: Slot; seq: number; data?: string; error?: boolean }>) => {
      // si mientras tanto se pidió otro guardado, este ya está viejo
      if (e.data.seq !== seq) return;
      if (e.data.error || !e.data.data) onError?.();
      else escribe(e.data.slot, e.data.data);
    });
  } catch {
    worker = null;
  }
  return worker;
}

/** Guarda la partida (comprimida, sin bloquear). Devuelve false si falla al momento. */
export function saveGame(slot: Slot, s: GameState): boolean {
  try {
    localStorage.setItem(metaKey(slot), JSON.stringify(metaOf(s)));
    const w = getWorker();
    seq++;
    if (w) w.postMessage({ slot, seq, state: s });
    else localStorage.setItem(gameKey(slot), compressToUTF16(JSON.stringify(s)));
    return true;
  } catch {
    return false;
  }
}

// ---------- copias de seguridad en archivo ----------

/** Contenido del archivo de copia: una cabecera legible y la partida comprimida */
interface BackupFile {
  app: 'fowner';
  format: 1;
  exportedAt: number;
  meta: SlotMeta;
  data: string;
}

/** Copia de una partida en texto, para guardarla como archivo */
export function exportSave(s: GameState): string {
  const copia: BackupFile = { app: 'fowner', format: 1, exportedAt: Date.now(), meta: metaOf(s), data: compressToBase64(JSON.stringify(s)) };
  return JSON.stringify(copia);
}

/** Nombre del archivo de copia: fowner-cd-laredo-t3-2026-10-09.json */
export function backupFileName(s: GameState) {
  const club = metaOf(s).club.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `fowner-${club || 'partida'}-t${s.season}-${new Date().toISOString().slice(0, 10)}.json`;
}

/** Lee una copia: devuelve la partida o un texto con el problema */
export function importSave(texto: string): GameState | string {
  let copia: Partial<BackupFile>;
  try {
    copia = JSON.parse(texto) as Partial<BackupFile>;
  } catch {
    return 'El archivo no es una copia de Fowner.';
  }
  if (copia.app !== 'fowner' || typeof copia.data !== 'string') return 'El archivo no es una copia de Fowner.';
  let s: GameState;
  try {
    s = JSON.parse(decompressFromBase64(copia.data) ?? '') as GameState;
  } catch {
    return 'La copia está dañada y no se puede leer.';
  }
  if (!s?.club || !Array.isArray(s.teams)) return 'La copia está dañada y no se puede leer.';
  if (s.version !== SAVE_VERSION) return 'La copia es de una versión del juego que no es compatible con esta.';
  migrate(s);
  return s;
}

export function deleteGame(slot: Slot) {
  seq++; // un guardado en curso ya no debe escribir
  try {
    localStorage.removeItem(gameKey(slot));
    localStorage.removeItem(metaKey(slot));
  } catch {
    // nada que borrar
  }
}
