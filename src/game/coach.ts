import { MATCHDAYS, fmtMoney, roundMoney } from './economy';
import { changeSatisfaction, currentPosition, objectiveTarget } from './fans';
import { addMessage, myTeam, mySquad } from './market';
import { FORMATIONS, STYLES, elevenFor, fatiguePenalty, type Formation, type Style } from './match';
import { coachSeverance, ROLES, type Staff } from './staff';
import { pick } from './rng';
import type { GameState, Player } from './types';
import { fitBonus } from './traits';

// El entrenador: su sistema y estilo son los que juega el equipo, tiene contrato y la grada lo juzga.

/** Sistema con el que juega el equipo cuando no hay entrenador (lo organiza el capitán) */
const SIN_ENTRENADOR = { formation: '4-4-2' as Formation, style: 'equilibrado' as Style };

export const coachOf = (s: GameState) => s.club.staff.entrenador;

/** Completa los datos tácticos de un entrenador de partidas antiguas */
export function ensureCoach(c: Staff, preferida?: Formation) {
  c.formation ??= preferida ?? pick(['4-4-2', '4-4-2', '4-3-3', '4-5-1', '5-3-2', '3-5-2'] as Formation[]);
  c.style ??= 'equilibrado';
  c.contract ??= 2;
  c.confidence ??= 60;
}

/** Sistema y estilo del equipo: los del entrenador, siempre */
export function ourTactics(s: GameState) {
  const c = coachOf(s);
  return c?.formation ? { formation: c.formation, style: c.style ?? 'equilibrado' } : SIN_ENTRENADOR;
}

/** Once que pone nuestro entrenador con su sistema */
export function ourPlan(s: GameState, squad: Player[] = mySquad(s)) {
  const t = ourTactics(s);
  const coach = coachOf(s)?.id ?? 0;
  // el entrenador alinea por rendimiento real: nivel más encaje en su sistema
  // y rota a los cansados: un suplente fresco puede rendir más que un titular agotado
  return { ...elevenFor(squad, t.formation, (p) => p.ovr + fitBonus(p, t.formation, t.style, coach) - fatiguePenalty(p)), ...t };
}

/** Jugadores por línea que pide el sistema del entrenador */
export const ourShape = (s: GameState) => FORMATIONS[ourTactics(s).formation];

export const tacticsLabel = (f: Formation, st: Style) => `${f} · ${STYLES[st].icon} ${STYLES[st].label}`;

export function confidenceLabel(v: number) {
  if (v >= 75) return { emoji: '💚', text: 'Muy alta' };
  if (v >= 55) return { emoji: '🙂', text: 'Buena' };
  if (v >= 35) return { emoji: '😐', text: 'En duda' };
  if (v >= 20) return { emoji: '😠', text: 'Cuestionado' };
  return { emoji: '🔥', text: 'La grada pide su cabeza' };
}

/** Tras cada partido de liga: la confianza en el entrenador sube o baja */
export function coachAfterMatch(s: GameState, gf: number, gc: number) {
  const c = coachOf(s);
  if (!c) return;
  ensureCoach(c);
  let d = gf > gc ? 2.5 : gf < gc ? -3 : -0.3;
  if (s.club.objective && s.matchday >= 6) {
    const pos = currentPosition(s);
    const objetivo = objectiveTarget(s.club.objective, myTeam(s).division);
    if (pos > objetivo + 3) d -= 1;
    else if (pos <= objetivo) d += 0.5;
  }
  // con el tiempo los ánimos se templan: solo una mala racha larga lo deja contra las cuerdas
  d += (55 - c.confidence!) * 0.05;
  c.confidence = Math.max(0, Math.min(100, Math.round((c.confidence! + d) * 10) / 10));
  if (c.confidence < 30 && !c.warned) {
    c.warned = true;
    addMessage(s, {
      from: 'prensa',
      title: `🔥 La grada pide la cabeza de ${c.name}`,
      body:
        `Los malos resultados ponen al entrenador contra las cuerdas. Mientras siga, la afición estará más descontenta.\n` +
        `Puedes destituirlo en Dirección → Empleados. Indemnización: ${fmtMoney(coachSeverance(s, c))} (lo que le queda de contrato).`,
    });
  } else if (c.confidence >= 45) c.warned = false;
  if (c.confidence < 25) changeSatisfaction(s, -0.5, `La grada contra ${c.name}`);
  // aviso de fin de contrato con tiempo para decidir
  if (s.matchday === MATCHDAYS - 8 && c.contract === 1) {
    addMessage(s, {
      from: 'club',
      title: `🧢 El contrato de ${c.name} acaba esta temporada`,
      body: `Si no lo renuevas en Dirección → Empleados, se marchará en verano. Pide ${fmtMoney(coachRenewal(c).salary)}/temp. por 2 temporadas más.`,
    });
  }
}

/** Lo que pide el entrenador por renovar 2 temporadas */
export function coachRenewal(c: Staff) {
  return { years: 2, salary: roundMoney(c.salary * (1.05 + 0.04 * c.stars)) };
}

export function renewCoach(s: GameState): string {
  const c = coachOf(s);
  if (!c) return 'No tienes entrenador.';
  ensureCoach(c);
  const r = coachRenewal(c);
  c.contract! += r.years;
  c.salary = r.salary;
  addMessage(s, { from: 'club', title: `✍️ ${c.name} renueva`, body: `${r.years} temporadas más por ${fmtMoney(r.salary)}/temp.` });
  return `${c.name} renovado hasta dentro de ${c.contract} temporadas`;
}

/** Fin de temporada: corre el contrato; si acaba, se va (o el director lo renueva si lo tiene delegado) */
export function coachEndSeason(s: GameState) {
  const c = coachOf(s);
  if (!c) return;
  ensureCoach(c);
  c.contract!--;
  // el verano calma (o enfría) los ánimos
  c.confidence = Math.round(60 + (c.confidence! - 60) * 0.5);
  c.warned = false;
  if (c.contract! > 0) return;
  if (s.club.director && s.club.delegation.empleados === 'auto' && c.confidence >= 50) {
    renewCoach(s);
    addMessage(s, { from: 'director', title: `He renovado a ${c.name}`, body: 'El equipo funciona con él: dos temporadas más.' });
    return;
  }
  delete s.club.staff.entrenador;
  addMessage(s, {
    from: 'club',
    title: `👋 ${c.name} se marcha`,
    body: `Acabó su contrato y no ha renovado. Busca nuevo ${ROLES.entrenador.name.toLowerCase()} en Dirección → Empleados.`,
  });
}
