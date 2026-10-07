import { COSTE_INSTALACION, ESTADIO_COSTE_POR_ASIENTO, ESTADIO_JORNADAS_OBRA, NIVEL_MAX } from './economy';
import { runDirector } from './director';
import { addMessage } from './market';
import type { GameState, Level, Task } from './types';

export function setTicketPrice(s: GameState, price: number) {
  s.club.ticketPrice = Math.max(1, Math.round(price));
}

export const stadiumCost = (seats: number) => seats * ESTADIO_COSTE_POR_ASIENTO;

export function expandStadium(s: GameState, seats: number): string | undefined {
  if (s.club.works) return 'Ya hay obras en marcha.';
  const coste = stadiumCost(seats);
  if (s.club.cash < coste) return 'No hay dinero suficiente.';
  s.club.cash -= coste;
  s.club.ledger.obras += coste;
  s.club.works = { kind: 'estadio', matchdaysLeft: ESTADIO_JORNADAS_OBRA, amount: seats };
  addMessage(s, { from: 'club', title: 'Empiezan las obras del estadio', body: `+${seats} asientos. Estarán listas en ${ESTADIO_JORNADAS_OBRA} jornadas.` });
}

export function upgradeFacility(s: GameState, kind: 'training' | 'academy'): string | undefined {
  const nivel = s.club[kind];
  if (nivel >= NIVEL_MAX) return 'Ya está al máximo.';
  const coste = COSTE_INSTALACION[nivel + 1];
  if (s.club.cash < coste) return 'No hay dinero suficiente.';
  s.club.cash -= coste;
  s.club.ledger.obras += coste;
  s.club[kind] = nivel + 1;
}

export function setDelegation(s: GameState, task: Task, level: Level) {
  s.club.delegation[task] = level;
  runDirector(s, 'cambio');
}

export function setBudgets(s: GameState, transferBudget: number, wageCap: number) {
  s.club.transferBudget = Math.max(0, Math.round(transferBudget));
  s.club.wageCap = Math.max(0, Math.round(wageCap));
}

export function setAllDelegation(s: GameState, level: Level) {
  for (const t of Object.keys(s.club.delegation) as Task[]) s.club.delegation[t] = level;
  runDirector(s, 'cambio');
}
