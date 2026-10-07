import { SAVE_VERSION } from './generate';
import type { GameState } from './types';

const KEY = 'fowner-partida';

export function loadGame(): GameState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as GameState;
    return s.version === SAVE_VERSION ? s : null;
  } catch {
    return null;
  }
}

export function saveGame(s: GameState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // sin almacenamiento (modo privado): se juega sin guardar
  }
}

export function deleteGame() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // nada que borrar
  }
}
