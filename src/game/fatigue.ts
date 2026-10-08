import { staffStars } from './staff';
import { hasTrait } from './traits';
import type { GameState, Player } from './types';

// Cansancio: cada partido cansa a los titulares y cada jornada se recupera algo.
// Jugar siempre con los mismos (y más con Copa o Europa entre semana) hace que rindan menos y se lesionen más.

/** Suma el cansancio de un partido a los titulares */
export function tire(s: GameState, xi: Player[]) {
  const prep = staffStars(s, 'preparador');
  for (const p of xi) {
    let f = 17 + Math.max(0, p.age - 29) * 1.5;
    if (p.teamId === s.club.teamId) f *= 1 - 0.07 * prep; // el preparador físico dosifica las cargas
    if (hasTrait(p, 'profesional')) f *= 0.8;
    p.fatigue = Math.min(100, (p.fatigue ?? 0) + f);
  }
}

/** Recuperación de una semana: más cuanto más cansado está */
export function recoverAll(s: GameState) {
  for (const p of s.players) {
    if (!p.fatigue) continue;
    p.fatigue = Math.max(0, p.fatigue - (9 + p.fatigue * 0.15));
    if (p.fatigue < 0.5) p.fatigue = 0;
  }
}

/** Condición física (100 = fresco) */
export const condition = (p: Player) => Math.round(100 - (p.fatigue ?? 0));

/** El cansancio también dispara las lesiones */
export const fatigueInjuryFactor = (p: Player) => 1 + Math.max(0, (p.fatigue ?? 0) - 30) / 40;
