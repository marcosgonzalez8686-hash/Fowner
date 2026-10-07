import { buildingLevel } from './land';
import { addMessage } from './market';
import { chance, clamp, rand } from './rng';
import { staffStars } from './staff';
import type { GameState, Player } from './types';

// Lesiones de jugadores y moral del vestuario

/** Probabilidad de lesión de cada titular en un partido */
const PROB_LESION = 0.014;

/** ¿Está lesionado? */
export const isInjured = (p: Player) => (p.injury ?? 0) > 0;

/** Duración de una lesión nueva, en jornadas */
function injuryLength() {
  const r = Math.random();
  if (r < 0.65) return Math.ceil(rand(1, 3));
  if (r < 0.92) return Math.ceil(rand(3, 8));
  return Math.ceil(rand(9, 20));
}

const TIPOS = [
  [3, 'molestias musculares'], [8, 'rotura fibrilar'], [14, 'esguince de tobillo'], [99, 'lesión de rodilla'],
] as const;
export const injuryName = (j: number) => TIPOS.find(([max]) => j <= max)![1];

/**
 * Tira lesiones para los titulares de un partido. En nuestro club el preparador físico
 * las hace menos probables y el centro médico y el fisio, más cortas.
 */
export function rollInjuries(s: GameState, xi: Player[], teamId: number): Player[] {
  const mio = teamId === s.club.teamId;
  const prob = PROB_LESION * (mio ? 1 - 0.12 * staffStars(s, 'preparador') : 1);
  const recuperacion = mio ? 1 - 0.1 * buildingLevel(s, 'medico') - 0.08 * staffStars(s, 'fisio') : 1;
  const nuevas: Player[] = [];
  for (const p of xi) {
    if (isInjured(p) || !chance(prob)) continue;
    p.injury = Math.max(1, Math.round(injuryLength() * clamp(recuperacion, 0.45, 1)));
    nuevas.push(p);
  }
  return nuevas;
}

/** Cada jornada los lesionados están un poco más cerca de volver */
export function healOneMatchday(s: GameState, lesionadosAntes: Set<number>) {
  const recuperados: Player[] = [];
  for (const p of s.players) {
    if (!isInjured(p) || !lesionadosAntes.has(p.id)) continue;
    p.injury = (p.injury ?? 0) - 1;
    if (p.injury <= 0) {
      p.injury = 0;
      if (p.teamId === s.club.teamId) recuperados.push(p);
    }
  }
  if (recuperados.length) {
    addMessage(s, {
      from: 'club',
      title: `Alta médica: ${recuperados.map((p) => p.name).join(', ')}`,
      body: 'Vuelven a estar disponibles para el entrenador.',
    });
  }
}

/** Nivel de moral en texto */
export function moraleLabel(m: number) {
  if (m >= 80) return { emoji: '🔥', text: 'Eufórico' };
  if (m >= 62) return { emoji: '😀', text: 'Alta' };
  if (m >= 42) return { emoji: '🙂', text: 'Normal' };
  if (m >= 25) return { emoji: '😕', text: 'Baja' };
  return { emoji: '😠', text: 'Por los suelos' };
}

/** La moral suma o resta fuerza al equipo en el partido (de -2,5 a +2,5) */
export const moraleBonus = (s: GameState) => (s.club.morale - 50) / 20;

/** Hacia dónde tiende la moral cuando no pasa nada: un buen entrenador la sostiene */
const moraleRest = (s: GameState) => 50 + 2 * staffStars(s, 'entrenador') + staffStars(s, 'segundo');

export function changeMorale(s: GameState, delta: number) {
  s.club.morale = clamp(Math.round(s.club.morale + delta), 0, 100);
}

/** Moral después de un partido */
export function moraleAfterMatch(s: GameState, gf: number, gc: number) {
  const delta = gf > gc ? 4 + Math.min(2, gf - gc - 1) : gf < gc ? -4 - Math.min(2, gc - gf - 1) : 1;
  changeMorale(s, delta);
  // poco a poco vuelve a su nivel normal
  changeMorale(s, (moraleRest(s) - s.club.morale) * 0.12);
}

export function resetSeasonMorale(s: GameState) {
  s.club.morale = Math.round((s.club.morale + moraleRest(s)) / 2);
  for (const p of s.players) p.injury = 0;
}
