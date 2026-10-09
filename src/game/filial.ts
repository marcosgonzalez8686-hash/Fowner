import { DIV_LEVEL, fmtMoney, roundMoney } from './economy';
import { addMessage, myFilial, mySquad, myTeam } from './market';
import { chance, clamp, rand, randInt } from './rng';
import { buildingLevel } from './land';
import type { GameState, Player } from './types';

// Filial (equipo B): los jóvenes juegan cada semana en su propia liga y crecen más.
// Siguen siendo nuestros (cobran su sueldo), pero no cuentan para el primer equipo.

export const FILIAL_MAX = 8;
export const FILIAL_AGE = 23;
/** Partidos con el filial para notar el extra de crecimiento */
export const FILIAL_GROWTH_APPS = 12;
const COSTE_CREAR = [300_000, 120_000, 50_000, 20_000, 10_000];
const MIN_PRIMER_EQUIPO = 16;

export const filialCreateCost = (s: GameState) => COSTE_CREAR[myTeam(s).division];
/** Equipación, cuerpo técnico, desplazamientos y arbitrajes del filial cada temporada */
export const filialSeasonCost = (s: GameState) => (s.club.filial ? roundMoney(COSTE_CREAR[myTeam(s).division] * 0.6) : 0);
export const filialName = (s: GameState) => `${myTeam(s).name} B`;

export function createFilial(s: GameState): string | undefined {
  if (s.club.filial) return 'Ya tienes filial.';
  const coste = filialCreateCost(s);
  if (s.club.cash < coste) return `Hace falta ${fmtMoney(coste)} para inscribir el filial.`;
  s.club.cash -= coste;
  s.club.ledger.personal += coste;
  s.club.filial = { since: s.season };
  addMessage(s, {
    from: 'club',
    title: `🅱️ Nace el ${filialName(s)}`,
    body: `El filial ya está inscrito. Envía allí a jóvenes de hasta ${FILIAL_AGE} años (máximo ${FILIAL_MAX}) para que jueguen cada semana. Cuesta ${fmtMoney(filialSeasonCost(s))} por temporada, además de sus sueldos.`,
  });
}

/** ¿Puede ir al filial? Devuelve el motivo si no */
export function filialBlock(s: GameState, p: Player): string | undefined {
  if (!s.club.filial) return 'No tienes filial.';
  if (p.teamId !== s.club.teamId || p.loan) return 'No es un jugador nuestro.';
  if (p.age > FILIAL_AGE) return `Solo jugadores de ${FILIAL_AGE} años o menos.`;
  if (myFilial(s).length >= FILIAL_MAX) return `El filial está completo (${FILIAL_MAX} jugadores).`;
  if (!p.youth && mySquad(s).length <= MIN_PRIMER_EQUIPO) return `El primer equipo no puede quedarse con menos de ${MIN_PRIMER_EQUIPO} jugadores.`;
}

/** Enviar al filial (un jugador del primer equipo o un juvenil recién salido de la cantera) */
export function sendToFilial(s: GameState, playerId: number): string | undefined {
  const p = s.players.find((x) => x.id === playerId);
  if (!p) return 'El jugador ya no está.';
  const err = filialBlock(s, p);
  if (err) return err;
  if (p.youth) {
    p.youth = false;
    p.contract = Math.max(p.contract, 3);
  }
  p.filial = true;
  p.listed = false;
}

export function promoteFromFilial(s: GameState, playerId: number): string | undefined {
  const p = myFilial(s).find((x) => x.id === playerId);
  if (!p) return 'No está en el filial.';
  p.filial = false;
}

/** Cada jornada de liga el filial juega su partido */
export function filialMatchday(s: GameState) {
  if (!s.club.filial) return;
  for (const p of myFilial(s)) if (!(p.injury && p.injury > 0)) p.filialApps = (p.filialApps ?? 0) + 1;
}

/** Tras la evolución del verano: extra de crecimiento, los mayores suben y resumen de la temporada del filial */
export function filialEndSeason(s: GameState) {
  if (!s.club.filial) return;
  const jugadores = myFilial(s);
  if (!jugadores.length) return;
  const crecen: string[] = [];
  const suben: string[] = [];
  for (const p of jugadores) {
    const tope = p.pot + (p.potHidden ?? 0);
    if ((p.filialApps ?? 0) >= FILIAL_GROWTH_APPS && p.ovr < tope) {
      // con estadio propio para el filial crecen algo más
      const extra = Math.min(tope - p.ovr, randInt(1, 3) + (chance(0.3 * buildingLevel(s, 'campoFilial')) ? 1 : 0));
      p.ovr += extra;
      if (p.ovr > p.pot) p.pot = p.ovr;
      crecen.push(`${p.name} (+${extra})`);
    }
    p.filialApps = 0;
    // con la edad cumplida vuelve al primer equipo
    if (p.age > FILIAL_AGE) {
      p.filial = false;
      suben.push(p.name);
    }
  }
  // puesto orientativo en su liga según el nivel del equipo B
  const media = jugadores.reduce((a, p) => a + p.ovr, 0) / jugadores.length;
  const puesto = clamp(Math.round(10 - (media - (DIV_LEVEL[DIV_LEVEL.length - 1] - 4)) * 0.8 + rand(-3, 3)), 1, 20);
  addMessage(s, {
    from: 'club',
    title: `🅱️ Temporada del ${filialName(s)}: ${puesto}º`,
    body:
      (crecen.length ? `Han crecido jugando cada semana: ${crecen.join(', ')}.` : 'Esta temporada nadie ha dado un salto especial.') +
      (suben.length ? `\nCumplen la edad y suben al primer equipo: ${suben.join(', ')}.` : ''),
  });
}
