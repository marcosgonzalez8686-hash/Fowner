import { STYLES, elevenFor, fatiguePenalty, type Formation, type Style } from './match';
import { condition } from './fatigue';
import { coachOf, ourTactics } from './coach';
import { mySquad } from './market';
import { moraleBonus } from './morale';
import { staffMatchBonus } from './staff';
import { fitBonus, fitOf } from './traits';
import type { GameState, Player } from './types';

// Pronóstico antes del partido y claves para entender el resultado después.

/** Goles esperados de cada equipo (la misma fórmula que usa el simulador) */
export function lambdas(first: number, second: number, s1: Style, s2: Style) {
  const d = (first - second) / 9;
  return {
    l1: (1.45 * Math.exp(d * 0.55) + 0.05) * STYLES[s1].att * STYLES[s2].conc,
    l2: (1.15 * Math.exp(-d * 0.55) + 0.05) * STYLES[s2].att * STYLES[s1].conc,
  };
}

const poissonPmf = (l: number, k: number) => {
  let p = Math.exp(-l);
  for (let i = 1; i <= k; i++) p *= l / i;
  return p;
};

// cuantiles de la "forma del día" (diferencia de dos normales de desviación 2)
const RUIDO = [-1.6, -1.0, -0.6, -0.3, 0, 0.3, 0.6, 1.0, 1.6].map((z) => z * 2 * Math.SQRT2);

/** Probabilidades de victoria, empate y derrota para el primer equipo */
export function winProbs(first: number, second: number, s1: Style, s2: Style) {
  let g = 0;
  let e = 0;
  for (const r of RUIDO) {
    const { l1, l2 } = lambdas(first + r, second, s1, s2);
    for (let i = 0; i <= 9; i++) {
      const pi = poissonPmf(l1, i);
      for (let j = 0; j <= 9; j++) {
        const p = pi * poissonPmf(l2, j);
        if (i > j) g += p;
        else if (i === j) e += p;
      }
    }
  }
  g /= RUIDO.length;
  e /= RUIDO.length;
  return { win: g, draw: e, loss: Math.max(0, 1 - g - e) };
}

const n1 = (x: number) => x.toFixed(1).replace('.', ',');
const apellido = (n: string) => n.split(' ').slice(1).join(' ') || n;

/** Lo que pesa antes de jugar: encaje, bajas, moral y banquillo */
export function preMatchKeys(s: GameState, xi: Player[]): string[] {
  const t = ourTactics(s);
  const coach = coachOf(s)?.id ?? 0;
  const out: string[] = [];
  // sin cifras: solo cómo encaja el once en el sistema y quién no está cómodo
  const mal = xi.filter((p) => fitOf(p, t.formation, t.style) < 0 && fitBonus(p, t.formation, t.style, coach) < -1);
  const encaje = xi.reduce((a, p) => a + fitBonus(p, t.formation, t.style, coach), 0) / 11;
  if (encaje >= 0.6) out.push(`🧩 El once encaja muy bien en el ${t.formation}.`);
  if (mal.length) out.push(`🧩 No terminan de encajar en el ${t.formation}: ${mal.map((p) => apellido(p.name)).join(', ')}.`);
  // titulares de siempre que se pierden el partido
  const sano = elevenFor(mySquad(s).map((p) => ({ ...p, injury: 0, suspended: 0 })), t.formation as Formation, (p) => p.ovr + fitBonus(p, t.formation, t.style, coach)).xi;
  const enXi = new Set(xi.map((p) => p.id));
  const lesionados = new Set(mySquad(s).filter((p) => (p.injury ?? 0) > 0).map((p) => p.id));
  const bajas = sano.filter((p) => !enXi.has(p.id) && lesionados.has(p.id));
  if (bajas.length) out.push(`🤕 Bajas en el once: ${bajas.map((p) => `${apellido(p.name)} (${p.ovr})`).join(', ')}.`);
  const sancionadosIds = new Set(mySquad(s).filter((p) => (p.suspended ?? 0) > 0).map((p) => p.id));
  const sancionados = sano.filter((p) => !enXi.has(p.id) && sancionadosIds.has(p.id));
  if (sancionados.length) out.push(`🟥 Sancionados: ${sancionados.map((p) => `${apellido(p.name)} (${p.ovr})`).join(', ')}.`);
  // cansancio: titulares fatigados y quién descansa por rotación
  const cansados = xi.filter((p) => fatiguePenalty(p) >= 0.5);
  if (cansados.length) out.push(`🪫 Llegan cansados: ${cansados.map((p) => `${apellido(p.name)} (${condition(p)}%)`).join(', ')}.`);
  const sinCansancio = elevenFor(mySquad(s).filter((p) => !(p.injury && p.injury > 0) && !(p.suspended && p.suspended > 0)), t.formation, (p) => p.ovr + fitBonus(p, t.formation, t.style, coach)).xi;
  const descansan = sinCansancio.filter((p) => !enXi.has(p.id));
  if (descansan.length) out.push(`🔄 Rotación: descansan ${descansan.map((p) => `${apellido(p.name)} (${condition(p)}%)`).join(', ')}.`);
  const mb = moraleBonus(s);
  if (Math.abs(mb) >= 0.75) out.push(mb > 0 ? '😀 El vestuario está con la moral por las nubes.' : '😞 El vestuario está tocado.');
  if (!coachOf(s)) out.push('🧢 Se nota la falta de entrenador.');
  else if (staffMatchBonus(s) >= 3) out.push('🧢 El cuerpo técnico tiene al equipo bien trabajado.');
  return out;
}

export interface MatchContext {
  gf: number;
  gc: number;
  ours: number; // nuestra fuerza antes de la forma del día (con extras)
  rival: number;
  oursDay: number; // con la forma del día
  rivalDay: number;
  home: boolean | null; // null = campo neutral
  rivalStyle: Style;
  xi: Player[];
}

/** Claves del partido para el resumen */
export function matchKeys(s: GameState, c: MatchContext): string[] {
  const t = ourTactics(s);
  const out: string[] = [];
  const extras = staffMatchBonus(s) + moraleBonus(s);
  out.push(
    `📊 Nivel del once: ${n1(c.ours - extras)} contra ${n1(c.rival)}` +
      `${c.home === true ? ', en casa' : c.home === false ? ', fuera' : ', en campo neutral'}.`,
  );
  out.push(...preMatchKeys(s, c.xi));
  if (t.style !== 'equilibrado' || c.rivalStyle !== 'equilibrado') {
    out.push(`♟️ Planteamientos: nosotros ${STYLES[t.style].label.toLowerCase()}, ellos ${STYLES[c.rivalStyle].label.toLowerCase()}.`);
  }
  const dia = c.oursDay - c.ours - (c.rivalDay - c.rival);
  if (dia >= 2) out.push('🔥 Día inspirado: el equipo rindió por encima de lo normal.');
  else if (dia <= -2) out.push('🥶 Día gris: el equipo rindió por debajo de lo normal.');
  // ventaja de campo como en la liga (+2 para el local)
  const casa = c.home === true ? 2 : c.home === false ? -2 : 0;
  const p = winProbs(c.ours + casa, c.rival, t.style, c.rivalStyle);
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  out.push(`🎯 Pronóstico: ganar ${pct(p.win)} · empate ${pct(p.draw)} · perder ${pct(p.loss)}.`);
  if (c.gf > c.gc && p.win < 0.3) out.push(`💪 ¡Gesta! Solo teníamos un ${pct(p.win)} de ganar.`);
  else if (c.gf < c.gc && p.win > 0.55) out.push(`🍀 Sorpresa: éramos favoritos (${pct(p.win)} de ganar) y se escapó.`);
  else if (c.gf === c.gc && Math.max(p.win, p.loss) > 0.55) out.push(`⚖️ Empate ${p.win > p.loss ? 'que sabe a poco' : 'que vale oro'}: ${pct(p.win)} de ganar, ${pct(p.loss)} de perder.`);
  return out;
}
