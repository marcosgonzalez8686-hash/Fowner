import { runDirector } from './director';
import type { GameState, Level, Task } from './types';

export function setTicketPrice(s: GameState, price: number) {
  s.club.ticketPrice = Math.max(1, Math.round(price));
}

// la ampliación del estadio vive en stadium.ts
export { expandStadium, stadiumCost } from './stadium';

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
