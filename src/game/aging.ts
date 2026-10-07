import { fmtMoney, roundMoney } from './economy';
import { changeSatisfaction } from './fans';
import { addMessage, mySquad } from './market';
import { chance, clamp, pick, rand, randInt } from './rng';
import type { GameState, Player, Pos } from './types';

// Envejecimiento y retiradas: cada posición tiene su edad de madurez; los veteranos anuncian su adiós.

/** Edad hasta la que un jugador mantiene su nivel (los porteros duran más) */
export const PEAK: Record<Pos, number> = { POR: 32, DEF: 30, MED: 30, DEL: 29 };

/** Partidos en el club a partir de los que la retirada merece un partido homenaje */
export const LEGEND_APPS = 60;

export type Trend = 'crece' | 'pico' | 'declive';

export function trendOf(p: Player): Trend {
  if (p.age <= 23 && p.pot > p.ovr) return 'crece';
  if (p.age < PEAK[p.pos] - 3 && p.pot > p.ovr) return 'crece';
  return p.age > PEAK[p.pos] ? 'declive' : 'pico';
}

export const TREND_TEXT: Record<Trend, { icon: string; text: string }> = {
  crece: { icon: '↗', text: 'en crecimiento' },
  pico: { icon: '→', text: 'en su mejor momento' },
  declive: { icon: '↘', text: 'en declive' },
};

/** Un año más: los jóvenes crecen, los de su mejor edad se mantienen y los veteranos bajan cada vez más */
export function develop(p: Player, training: number, aging = 1, growth = 1) {
  p.age++;
  const pico = PEAK[p.pos];
  if (p.age <= 23) {
    const crece = Math.max(0, p.pot - p.ovr) * rand(0.15, 0.4) * (0.75 + training * 0.1) * growth;
    p.ovr = Math.min(p.pot, Math.round(p.ovr + crece));
  } else if (p.age <= pico - 3) {
    // aún le queda algo por pulir
    const crece = Math.max(0, p.pot - p.ovr) * rand(0.05, 0.25) * (0.75 + training * 0.1);
    p.ovr = clamp(Math.round(p.ovr + crece) + randInt(-1, 1), 20, p.pot);
  } else if (p.age <= pico) {
    p.ovr = clamp(p.ovr + randInt(-1, 1), 20, p.pot);
  } else {
    // el declive se acelera con cada año de más
    const baja = (rand(0.5, 2) + (p.age - pico) * 0.7) * aging;
    p.ovr = Math.max(20, Math.round(p.ovr - baja));
  }
  p.pot = Math.max(p.pot, p.ovr);
}

/** Probabilidad de colgar las botas este verano */
export function retireChance(p: Player) {
  const a = p.age - (p.pos === 'POR' ? 1 : 0);
  if (a < 33) return 0;
  const tabla = [0.08, 0.18, 0.35, 0.55, 0.75];
  return tabla[a - 33] ?? 0.92;
}

/**
 * Hacia el final de la liga, los veteranos de nuestra plantilla deciden si se retiran.
 * Se avisa con tiempo para poder intentar convencerles.
 */
export function announceRetirements(s: GameState) {
  if (s.club.retireCheck === s.season) return;
  s.club.retireCheck = s.season;
  for (const p of mySquad(s)) {
    if (p.youth || p.retiring || !chance(retireChance(p))) continue;
    p.retiring = true;
    p.persuaded = false; // cada adiós anunciado se puede intentar frenar una vez
    const h = s.club.records.players[p.id];
    addMessage(s, {
      from: 'club',
      title: `👴 ${p.name} se retirará al final de temporada`,
      body:
        `A sus ${p.age} años, ${p.name} (${p.pos}, media ${p.ovr}) anuncia que colgará las botas en verano.` +
        (h ? ` Lleva ${h.apps} partidos y ${h.goals} goles con nosotros.` : '') +
        `\nPuedes intentar convencerle desde su ficha en Plantilla.`,
    });
  }
}

/** Intentar que un veterano siga un año más (solo una vez por jugador) */
export function persuadeVeteran(s: GameState, id: number): string {
  const p = s.players.find((x) => x.id === id);
  if (!p?.retiring) return 'No tiene intención de retirarse.';
  if (p.persuaded) return 'Ya lo intentaste: su decisión es firme.';
  p.persuaded = true;
  const prob = clamp(0.55 - (p.age - 33) * 0.1 + (s.club.morale - 50) / 200, 0.1, 0.8);
  if (!chance(prob)) return `${p.name} lo tiene claro: se retira.`;
  p.retiring = false;
  if (p.contract <= 1) {
    p.contract = 2;
    p.salary = roundMoney(p.salary * 0.9);
  }
  addMessage(s, { from: 'club', title: `💪 ${p.name} seguirá un año más`, body: `Le has convencido. Renueva una temporada por ${fmtMoney(p.salary)}.` });
  return `${p.name} seguirá un año más`;
}

/**
 * Despedida de los que se retiran: quedan en la historia y, si son leyendas del club,
 * partido homenaje (taquilla y afición) y quizá se quedan como técnicos.
 */
export function farewells(s: GameState, retirados: Player[]) {
  const rec = s.club.records;
  rec.retired ??= [];
  for (const p of retirados) {
    const h = rec.players[p.id] ?? { apps: 0, goals: 0 };
    const leyenda = h.apps >= LEGEND_APPS;
    rec.retired.push({ name: p.name, pos: p.pos, season: s.season - 1, age: p.age, apps: h.apps, goals: h.goals, tribute: leyenda });
    if (!leyenda) continue;
    // partido homenaje: estadio casi lleno
    const ingreso = roundMoney(s.club.capacity * 0.9 * s.club.ticketPrice);
    s.club.cash += ingreso;
    s.club.ledger.taquilla += ingreso;
    changeSatisfaction(s, 3, `Homenaje a ${p.name}`);
    let extra = '';
    // a veces quiere seguir ligado al club
    if (chance(0.5)) {
      const role = pick(['segundo', 'ojeador'] as const);
      const ref = s.staffMarket[role]?.[0];
      if (ref) {
        s.staffMarket[role].push({ id: s.nextId++, name: p.name, role, stars: randInt(1, 3), salary: roundMoney(ref.salary * 0.9), trait: 'Leyenda del club' });
        extra = `\n\nQuiere seguir en casa: está entre los candidatos a ${role === 'segundo' ? 'segundo entrenador' : 'jefe de ojeadores'} (Dirección → Empleados).`;
      }
    }
    addMessage(s, {
      from: 'club',
      title: `🎖️ Partido homenaje a ${p.name}`,
      body: `${h.apps} partidos y ${h.goals} goles con nuestra camiseta. El estadio se volcó en su despedida: ${fmtMoney(ingreso)} de taquilla.${extra}`,
    });
  }
}
