import { ESTADIO_COSTE_POR_ASIENTO, ESTADIO_JORNADAS_OBRA } from './economy';
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

export function setDelegation(s: GameState, task: Task, level: Level) {
  s.club.delegation[task] = level;
  runDirector(s, 'cambio');
}

export function setBudgets(s: GameState, transferBudget: number, wageCap: number, staffBudget = s.club.staffBudget) {
  s.club.transferBudget = Math.max(0, Math.round(transferBudget));
  s.club.wageCap = Math.max(0, Math.round(wageCap));
  s.club.staffBudget = Math.max(0, Math.round(staffBudget));
}

export function setAllDelegation(s: GameState, level: Level) {
  for (const t of Object.keys(s.club.delegation) as Task[]) s.club.delegation[t] = level;
  runDirector(s, 'cambio');
}
