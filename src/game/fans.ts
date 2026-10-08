import { DIV_PRICE, DIVISIONS, PROMOTE, TEAMS_PER_DIV } from './economy';
import { diff } from './difficulty';
import { addMessage, myTeam, squadOf } from './market';
import { bestEleven, computeStandings } from './match';
import { clamp } from './rng';
import type { GameState } from './types';

// Satisfacción de la afición (0-100) y objetivo de cada temporada.
// Si los socios se hartan, fuerzan la venta del club.

export type Objective = 'ascenso' | 'mitad' | 'salvacion';

export const OBJECTIVES: Record<Objective, { label: string; icon: string; reward: number; penalty: number }> = {
  ascenso: { label: 'Luchar por el ascenso', icon: '🚀', reward: 18, penalty: -22 },
  mitad: { label: 'Quedar en la mitad alta', icon: '🎯', reward: 12, penalty: -14 },
  salvacion: { label: 'Temporada tranquila', icon: '🛟', reward: 8, penalty: -10 },
};

/** Puesto que hay que alcanzar (o mejorar) para cumplir el objetivo */
export function objectiveTarget(obj: Objective, division: number) {
  if (obj === 'ascenso') return division === 0 ? 1 : PROMOTE;
  if (obj === 'mitad') return TEAMS_PER_DIV / 2;
  // en la última división no se baja: basta con no quedar en la zona baja
  return division === DIVISIONS - 1 ? TEAMS_PER_DIV - 5 : TEAMS_PER_DIV - PROMOTE;
}

export function objectiveText(obj: Objective, division: number) {
  const pos = objectiveTarget(obj, division);
  if (obj === 'ascenso') return division === 0 ? 'Ganar la liga' : 'Subir: top 2 o ganar el playoff (3º-6º)';
  return `Acabar ${pos}º o mejor`;
}

/** ¿Se ha cumplido? El ascenso cuenta si se sube (directo o por playoff) */
export function objectiveMet(obj: Objective, divAntes: number, posFinal: number, divDespues: number) {
  if (obj === 'ascenso' && divAntes > 0) return divDespues < divAntes;
  return posFinal <= objectiveTarget(obj, divAntes);
}

/** Puesto actual de nuestro club en su liga */
export function currentPosition(s: GameState) {
  const t = myTeam(s);
  const tabla = computeStandings(s.teams.filter((x) => x.division === t.division).map((x) => x.id), s.fixtures[t.division]);
  return tabla.findIndex((r) => r.teamId === t.id) + 1;
}

/** Lo que espera la afición según el nivel de la plantilla frente a los rivales */
export function expectedObjective(s: GameState): Objective {
  const t = myTeam(s);
  const fuerzas = s.teams
    .filter((x) => x.division === t.division)
    .map((x) => ({ id: x.id, f: bestEleven(squadOf(s, x.id)).strength }))
    .sort((a, b) => b.f - a.f);
  const rango = fuerzas.findIndex((x) => x.id === t.id) + 1;
  return rango <= 4 ? 'ascenso' : rango <= 11 ? 'mitad' : 'salvacion';
}

const ORDEN: Objective[] = ['salvacion', 'mitad', 'ascenso'];

export function satisfactionLabel(v: number) {
  if (v >= 80) return { emoji: '🤩', text: 'Entusiasmada' };
  if (v >= 60) return { emoji: '😊', text: 'Contenta' };
  if (v >= 40) return { emoji: '😐', text: 'Expectante' };
  if (v >= 20) return { emoji: '😠', text: 'Enfadada' };
  return { emoji: '🔥', text: 'En pie de guerra' };
}

/** Cambia la satisfacción y anota el motivo (se guardan los últimos) */
export function changeSatisfaction(s: GameState, delta: number, motivo: string) {
  if (!delta) return;
  // la paciencia de la afición depende de la dificultad: los disgustos pesan más o menos
  if (delta < 0) delta *= diff(s).fans;
  const antes = s.club.satisfaction;
  s.club.satisfaction = clamp(Math.round((s.club.satisfaction + delta) * 10) / 10, 0, 100);
  s.club.satLog.unshift({ season: s.season, matchday: s.matchday, delta: Math.round(delta * 10) / 10, text: motivo });
  if (s.club.satLog.length > 12) s.club.satLog.length = 12;
  // avisos al cruzar umbrales peligrosos
  for (const umbral of [30, 15]) {
    if (antes >= umbral && s.club.satisfaction < umbral) {
      addMessage(s, {
        from: 'prensa',
        title: umbral === 15 ? '🔥 Los socios piden tu salida' : '📢 La afición está descontenta',
        body:
          umbral === 15
            ? 'Hay pancartas contra la directiva. Si la satisfacción sigue cayendo, los socios forzarán la venta del club.'
            : 'Se oyen pitos en la grada. Mejora los resultados, baja el precio de las entradas o invierte en el club.',
      });
    }
  }
}

export function setObjective(s: GameState, obj: Objective) {
  if (s.phase !== 'pretemporada') return;
  s.club.objective = obj;
  const esperado = expectedObjective(s);
  const dif = ORDEN.indexOf(obj) - ORDEN.indexOf(esperado);
  // ser más ambicioso que lo que espera la afición ilusiona; menos, decepciona
  const ilusion = dif > 0 ? 4 : dif < 0 ? -5 : 1;
  const yaAnotado = s.club.satLog.find((x) => x.season === s.season && x.text.startsWith('Objetivo'));
  if (yaAnotado) {
    s.club.satisfaction = clamp(s.club.satisfaction - yaAnotado.delta, 0, 100);
    s.club.satLog = s.club.satLog.filter((x) => x !== yaAnotado);
  }
  changeSatisfaction(s, ilusion, `Objetivo: ${OBJECTIVES[obj].label.toLowerCase()}`);
}

/** Al empezar la pretemporada, la peña cuenta qué espera (una vez, en el buzón; no se repite en pantalla) */
export function fansExpectationMessage(s: GameState) {
  const textos: Record<Objective, { title: string; body: string }> = {
    ascenso: {
      title: '📣 La grada sueña con subir',
      body: 'En el bar de la peña no se habla de otra cosa: con esta plantilla, dicen, este año toca pelear por el ascenso. Prometer menos les sabría a poco.',
    },
    mitad: {
      title: '📣 La peña quiere ver al equipo arriba',
      body: 'Los socios no piden milagros, pero quieren un equipo que mire hacia arriba. Una temporada sin más les sabría a poco; hablar de ascenso les haría soñar… y te lo recordarían si fallas.',
    },
    salvacion: {
      title: '📣 La grada se conforma con no sufrir',
      body: 'Los veteranos de la peña lo tienen claro: este año lo importante es no pasar apuros. Si prometes más, ilusionarás a la grada, pero se acordarán si no llega.',
    },
  };
  addMessage(s, { from: 'prensa', ...textos[expectedObjective(s)] });
}

/** Cómo ha recibido la afición el objetivo anunciado esta temporada */
export function objectiveReaction(s: GameState) {
  const nota = s.club.satLog.find((x) => x.season === s.season && x.text.startsWith('Objetivo'));
  if (!nota) return null;
  return nota.delta > 1 ? { emoji: '🤩', text: 'Ilusión en la grada' } : nota.delta < 0 ? { emoji: '😒', text: 'A la grada le sabe a poco' } : { emoji: '🙂', text: 'A la grada le parece bien' };
}

/** Satisfacción tras cada jornada: resultado, marcha respecto al objetivo y precio de las entradas */
export function satisfactionAfterMatch(s: GameState, gf: number, gc: number, enCasa: boolean) {
  const t = myTeam(s);
  const res = gf > gc ? 'victoria' : gf < gc ? 'derrota' : 'empate';
  changeSatisfaction(s, gf > gc ? 1.4 : gf < gc ? -1.6 : 0, `Jornada ${s.matchday + 1}: ${res} ${gf}-${gc}`);
  // con el tiempo, la euforia y el enfado se templan
  s.club.satisfaction = clamp(Math.round((s.club.satisfaction - (s.club.satisfaction - 55) * 0.035) * 10) / 10, 0, 100);
  if (s.club.objective && s.matchday >= 6) {
    const pos = currentPosition(s);
    const objetivo = objectiveTarget(s.club.objective, t.division);
    if (pos > objetivo + 3) changeSatisfaction(s, -0.6, `Lejos del objetivo (${pos}º)`);
    else if (pos <= objetivo) changeSatisfaction(s, 0.3, `En puestos del objetivo (${pos}º)`);
  }
  if (enCasa) {
    const ratio = s.club.ticketPrice / DIV_PRICE[t.division];
    if (ratio > 1.3) changeSatisfaction(s, -0.8, 'Entradas caras');
    else if (ratio < 0.8) changeSatisfaction(s, 0.4, 'Entradas baratas');
  }
}

/** Balance del objetivo al acabar la liga. Devuelve true si los socios fuerzan la venta. */
export function satisfactionEndSeason(s: GameState, posFinal: number, divAntes: number, divDespues: number) {
  const obj = s.club.objective;
  if (obj) {
    const cumplido = objectiveMet(obj, divAntes, posFinal, divDespues);
    const info = OBJECTIVES[obj];
    changeSatisfaction(s, cumplido ? info.reward : info.penalty, `${cumplido ? 'Objetivo cumplido' : 'Objetivo fallado'}: ${info.label.toLowerCase()}`);
    addMessage(s, {
      from: 'prensa',
      title: cumplido ? '🎉 ¡Objetivo cumplido!' : '😞 Objetivo no cumplido',
      body: `${info.label}: acabamos ${posFinal}º. La afición ${cumplido ? 'está con el proyecto' : 'pide explicaciones'}.`,
    });
  }
  if (divDespues < divAntes) changeSatisfaction(s, 10, '¡Ascenso!');
  if (divDespues > divAntes) changeSatisfaction(s, -10, 'Descenso');
  s.club.objective = undefined;
  return s.club.satisfaction < 12;
}

/** Efectos de la satisfacción en el resto del juego */
export const attendanceSatisfaction = (s: GameState) => 0.8 + 0.4 * (s.club.satisfaction / 100);
export const sponsorSatisfaction = (s: GameState) => 0.85 + 0.3 * (s.club.satisfaction / 100);
export const fansGrowthSatisfaction = (s: GameState) => 1 + (s.club.satisfaction - 50) / 500;
