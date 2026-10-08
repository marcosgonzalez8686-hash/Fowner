import { buildingLevel } from './land';
import { addMessage } from './market';
import { staffStars } from './staff';
import { PROFILES, TRAITS } from './traits';
import type { GameState, Player } from './types';

// Informes de los ojeadores: sin informe no se conoce el perfil ni el carácter de los jugadores de fuera.

/** Informes por temporada: 3 por estrella del jefe de ojeadores y 2 por nivel de la oficina de ojeadores */
export const reportCapacity = (s: GameState) => staffStars(s, 'ojeador') * 3 + buildingLevel(s, 'ojeadores') * 2;

export function isKnown(s: GameState, p: Player) {
  return p.teamId === s.club.teamId || p.loan?.from === s.club.teamId || Boolean(s.club.scouted?.includes(p.id));
}

/** Potencial en palabras: nunca se muestra la cifra, solo cuánto margen parece tener */
export function potLabel(ovr: number, pot: number) {
  const margen = pot - ovr;
  if (margen >= 15) return 'potencial enorme';
  if (margen >= 9) return 'mucho potencial';
  if (margen >= 4) return 'aún puede mejorar';
  if (margen >= 1) return 'cerca de su techo';
  return 'en su techo';
}

/** Potencial que vemos: el real si lo conocemos (incluida la promesa oculta) */
export const shownPot = (s: GameState, p: Player) => p.pot + (isKnown(s, p) ? (p.potHidden ?? 0) : 0);

export const reportsLeft = (s: GameState) => Math.max(0, reportCapacity(s) - (s.club.reportsUsed ?? 0));

export function markKnown(s: GameState, id: number) {
  s.club.scouted = [...new Set([...(s.club.scouted ?? []), id])];
}

export function requestReport(s: GameState, id: number): string {
  const p = s.players.find((x) => x.id === id);
  if (!p) return 'Ese jugador ya no está.';
  if (isKnown(s, p)) return 'Ya tienes su informe.';
  const quedan = reportsLeft(s);
  if (quedan <= 0) {
    return reportCapacity(s) ? 'Los ojeadores no dan para más informes esta temporada.' : 'Necesitas un jefe de ojeadores (Dirección → Empleados).';
  }
  s.club.reportsUsed = (s.club.reportsUsed ?? 0) + 1;
  markKnown(s, id);
  const rasgos = p.traits?.length ? p.traits.map((t) => `${TRAITS[t].icon} ${TRAITS[t].name}`).join(', ') : 'nada que destacar';
  addMessage(s, {
    from: 'club',
    title: `🔭 Informe: ${p.name}`,
    body:
      `Perfil: ${p.profile ? PROFILES[p.profile].name : '—'}. Carácter: ${rasgos}.` +
      (p.potHidden ? '\n💎 ¡Promesa oculta! Los ojeadores creen que puede llegar mucho más lejos de lo que todos piensan.' : ''),
  });
  return p.potHidden ? `💎 ${p.name} es una promesa oculta` : `Informe de ${p.name} listo`;
}

/** Cada verano se renuevan los informes disponibles y se olvidan los de jugadores ya retirados */
export function scoutingNewSeason(s: GameState) {
  s.club.reportsUsed = 0;
  if (s.club.scouted) {
    const vivos = new Set(s.players.map((p) => p.id));
    s.club.scouted = s.club.scouted.filter((id) => vivos.has(id));
  }
}
