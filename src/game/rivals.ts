import { DIV_FANS } from './economy';
import { BUILDINGS, type BuildingKind } from './land';
import { STADIUM_REQ } from './costs';
import type { GameState, Team } from './types';
import { modelInfo } from './stadium';

// Instalaciones de los demás clubes: estadio y edificios. Se generan según la categoría y la afición
// y crecen poco a poco cuando el club sube o gana aficionados (nunca se derriban).

export interface RivalFacilities {
  stadium: string;
  capacity: number;
  levels: Partial<Record<BuildingKind, number>>;
}

// se calcula al usarla: así no depende del orden en que se cargan los módulos
const kinds = () => Object.keys(BUILDINGS) as BuildingKind[];
/** Aforo típico de cada categoría */
export const DIV_CAPACITY = [38_000, 15_000, 5_500, 1_800, 700];
/** Nivel típico de ciudad deportiva y cantera (máx. 5) y del resto de edificios (máx. 3) */
const DIV_MAIN = [4, 3, 2, 1, 0];
const DIV_OTHER = [3, 2, 1, 1, 0];

/** Número pseudoaleatorio estable para un club (siempre el mismo para el mismo id y clave) */
function hash(id: number, k: number) {
  let x = (id * 2654435761 + k * 40503) >>> 0;
  x ^= x >>> 13;
  x = Math.imul(x, 1274126177) >>> 0;
  return (x ^ (x >>> 16)) >>> 0;
}
const entre = (id: number, k: number, a: number, b: number) => a + (hash(id, k) % 1000) / 1000 * (b - a);

/** "CD Alto Nogalejo" → "Alto Nogalejo" */
function lugar(name: string) {
  return name.replace(/^(Real Club|Club Deportivo|Atlético|Deportivo|Sporting|Racing|Unión|Real|CD|SD|UD|CF|AD|AC|FC|SC|AS|SV|VV)\s+/, '').trim() || name;
}

function stadiumName(t: Team) {
  const l = lugar(t.name);
  const humildes = [`Campo Municipal de ${l}`, `Campo de ${l}`, `Campo Municipal ${l}`, `Campo de Deportes de ${l}`];
  const grandes = [`Estadio de ${l}`, `Estadio Municipal de ${l}`, `Nuevo Estadio de ${l}`, `Estadio ${l}`];
  const lista = t.country ? [`Stadium ${l}`, `Arena ${l}`, `Stade ${l}`] : t.division >= 3 ? humildes : grandes;
  return lista[hash(t.id, 1) % lista.length];
}

/** Lo que "le corresponde" a un club por su categoría y su afición */
function target(t: Team) {
  const div = t.country ? 0 : t.division;
  const afic = Math.sqrt(Math.max(0.2, t.fans / DIV_FANS[div]));
  let capacity = DIV_CAPACITY[div] * afic * entre(t.id, 2, 0.8, 1.25);
  if (!t.country) capacity = Math.max(capacity, (STADIUM_REQ[div] ?? 0) * 1.05);
  const levels: Partial<Record<BuildingKind, number>> = {};
  kinds().forEach((k, i) => {
    const principal = k === 'entrenamiento' || k === 'cantera';
    const base = (principal ? DIV_MAIN : DIV_OTHER)[div] + (t.country ? 1 : 0);
    const v = (hash(t.id, 10 + i) % 3) - 1; // -1, 0 o +1
    levels[k] = Math.max(0, Math.min(BUILDINGS[k].maxLevel, base + v));
  });
  return { capacity: Math.max(300, Math.round(capacity / 100) * 100), levels };
}

/** Instalaciones de un club (si no se han generado aún, las que le tocarían) */
export function facilitiesOf(t: Team): RivalFacilities {
  if (t.fac) return t.fac;
  const tg = target(t);
  return { stadium: stadiumName(t), ...tg };
}

/** Da instalaciones a los clubes que aún no las tienen */
export function ensureFacilities(teams: Team[]) {
  for (const t of teams) if (!t.fac) t.fac = facilitiesOf(t);
}

/** Cada verano los clubes amplían el estadio y mejoran algún edificio si les toca por su nueva categoría */
export function growFacilities(s: GameState) {
  for (const t of s.teams) {
    if (t.id === s.club.teamId) continue;
    const f = (t.fac ??= facilitiesOf(t));
    const tg = target(t);
    if (tg.capacity > f.capacity) f.capacity = Math.round((f.capacity + (tg.capacity - f.capacity) * 0.4) / 100) * 100;
    for (const k of kinds()) {
      if ((tg.levels[k] ?? 0) > (f.levels[k] ?? 0) && Math.random() < 0.5) f.levels[k] = (f.levels[k] ?? 0) + 1;
    }
  }
}

// ---------- efectos en el juego ----------

const nivelDe = (t: Team, k: BuildingKind) => facilitiesOf(t).levels[k] ?? 0;

/** Ventaja de jugar en casa: un estadio grande para su categoría aprieta más (y uno pequeño, menos) */
export function homeAdvantage(s: GameState, teamId: number) {
  const t = s.teams.find((x) => x.id === teamId);
  if (!t) return 2;
  const aforo = teamId === s.club.teamId ? s.club.capacity : facilitiesOf(t).capacity;
  const ratio = Math.min(2.5, Math.max(0.3, aforo / DIV_CAPACITY[t.division]));
  // el modelo de nuestro estadio también cuenta: la grada pegada al campo aprieta más
  return 1.4 + 0.6 * Math.log2(ratio + 1) + (teamId === s.club.teamId ? modelInfo(s).ambiente : 0);
}

/** Cómo crecen los jugadores de un rival en verano según su ciudad deportiva, su cantera y su centro médico */
export function rivalDevelopment(t: Team) {
  return {
    training: 1.5 + nivelDe(t, 'entrenamiento') * 0.5,
    youth: 1 + nivelDe(t, 'cantera') * 0.05,
    aging: 1 - nivelDe(t, 'medico') * 0.08,
  };
}

/** Probabilidad de que un hueco de la plantilla rival lo cubra un canterano con proyección */
export const rivalYouthChance = (t: Team) => nivelDe(t, 'cantera') * 0.08;
