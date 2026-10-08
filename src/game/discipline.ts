import { addMessage, mySquad } from './market';
import type { MatchReport } from './report';
import { chance } from './rng';
import type { GameState, Player } from './types';

// Tarjetas y sanciones de nuestros jugadores: 5 amarillas = un partido sin jugar;
// una roja, de 1 a 3 partidos. La sanción se cumple en nuestros siguientes partidos (de cualquier competición).

export const YELLOW_LIMIT = 5;
export const isSuspended = (p: Player) => (p.suspended ?? 0) > 0;

/** Tras un partido nuestro: los sancionados cumplen un partido y se apuntan las tarjetas nuevas */
export function applyCards(s: GameState, r: MatchReport, lado: 'home' | 'away') {
  const squad = mySquad(s);
  for (const p of squad) if (p.suspended) p.suspended--;
  for (const e of r.events) {
    if (e.side !== lado || (e.type !== 'amarilla' && e.type !== 'roja')) continue;
    const p = squad.find((x) => x.id === e.pid) ?? squad.find((x) => x.name === e.player);
    if (!p) continue;
    if (e.type === 'roja') {
      const partidos = chance(0.65) ? 1 : chance(0.7) ? 2 : 3;
      p.suspended = (p.suspended ?? 0) + partidos;
      addMessage(s, {
        from: 'liga',
        title: `🟥 ${p.name}, sancionado ${partidos} partido${partidos > 1 ? 's' : ''}`,
        body: `Vio la roja en el minuto ${e.min}. No podrá jugar ${partidos > 1 ? `los próximos ${partidos} partidos` : 'el próximo partido'}.`,
      });
      continue;
    }
    p.yellows = (p.yellows ?? 0) + 1;
    if (p.yellows >= YELLOW_LIMIT) {
      p.yellows = 0;
      p.suspended = (p.suspended ?? 0) + 1;
      addMessage(s, {
        from: 'liga',
        title: `🟨 ${p.name}, sancionado por acumulación`,
        body: `Ha llegado a ${YELLOW_LIMIT} amarillas: se pierde el próximo partido.`,
      });
    }
  }
}

/** En verano se limpian las amarillas (las sanciones pendientes se mantienen) */
export function resetYellows(s: GameState) {
  for (const p of s.players) if (p.yellows) p.yellows = 0;
}
