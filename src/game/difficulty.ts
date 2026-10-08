import type { GameState } from './types';

// Nivel de dificultad: se elige al crear la partida y ajusta la economía, la afición, los rivales y las lesiones.

export type Difficulty = 'facil' | 'normal' | 'dificil';

export interface DifficultyInfo {
  label: string;
  icon: string;
  desc: string;
  cash: number; // dinero inicial
  income: number; // televisión y patrocinios
  works: number; // obras, instalaciones y terreno
  fans: number; // cuánto pesan los enfados de la afición
  rival: number; // nivel extra de los rivales (media)
  injuries: number; // probabilidad de lesión de los nuestros
}

export const DIFFICULTY: Record<Difficulty, DifficultyInfo> = {
  facil: { label: 'Fácil', icon: '🙂', desc: 'Más dinero, obras más baratas, una afición paciente y rivales algo más flojos.', cash: 1.5, income: 1.2, works: 0.75, fans: 0.7, rival: -2, injuries: 0.7 },
  normal: { label: 'Normal', icon: '⚖️', desc: 'La experiencia pensada para el juego.', cash: 1, income: 1, works: 1, fans: 1, rival: 0, injuries: 1 },
  dificil: { label: 'Difícil', icon: '🔥', desc: 'Menos dinero, obras más caras, una afición exigente, rivales más fuertes y más lesiones.', cash: 0.6, income: 0.85, works: 1.25, fans: 1.3, rival: 2, injuries: 1.3 },
};

export const DIFFICULTY_KEYS: Difficulty[] = ['facil', 'normal', 'dificil'];
export const diff = (s: Pick<GameState, 'difficulty'>) => DIFFICULTY[s.difficulty ?? 'normal'];
