import { MATCHDAYS, fmtMoney, roundMoney } from './economy';
import { addMessage } from './market';
import { personName } from './names';
import { changeSatisfaction } from './fans';
import type { Formation, Style } from './match';
import { changeMorale } from './morale';
import { pick, rand, randInt, shuffle } from './rng';
import type { GameState } from './types';

// Empleados del club. Cada puesto tiene un efecto en el juego que crece con la calidad (1-5 estrellas).

export type Role = 'entrenador' | 'segundo' | 'preparador' | 'fisio' | 'ojeador' | 'marketing';

export interface Staff {
  id: number;
  name: string;
  role: Role;
  stars: number;
  salary: number; // € por temporada
  trait: string; // detalle de personalidad, solo decorativo
  // solo el entrenador:
  formation?: Formation; // su sistema favorito: es el que juega el equipo
  style?: Style; // su estilo de juego
  contract?: number; // temporadas que le quedan (incluida la actual)
  confidence?: number; // confianza de la grada y el club, 0-100
  warned?: boolean; // ya se avisó de que la grada pide su cabeza
}

export interface RoleInfo {
  name: string;
  icon: string;
  help: string;
  /** peso del sueldo respecto al entrenador */
  pay: number;
}

export const ROLES: Record<Role, RoleInfo> = {
  entrenador: { name: 'Entrenador', icon: '🧢', pay: 1, help: 'Hace rendir más al equipo en cada partido. Sin entrenador el equipo juega peor.' },
  segundo: { name: 'Segundo entrenador', icon: '📋', pay: 0.5, help: 'Algo más de rendimiento y los jóvenes progresan más.' },
  preparador: { name: 'Preparador físico', icon: '🏃', pay: 0.45, help: 'El equipo llega fresco a la segunda vuelta de la liga.' },
  fisio: { name: 'Fisioterapeuta', icon: '💆', pay: 0.4, help: 'Los veteranos se cuidan mejor y pierden menos nivel con la edad.' },
  ojeador: { name: 'Jefe de ojeadores', icon: '🔭', pay: 0.5, help: 'Tu director deportivo acierta más y cada verano descubre jóvenes promesas libres.' },
  marketing: { name: 'Responsable de marketing', icon: '📣', pay: 0.45, help: 'Mejores patrocinios y la afición crece más rápido.' },
};

export const ROLE_ORDER = Object.keys(ROLES) as Role[];

const RASGOS = [
  'Muy exigente', 'Cercano con la plantilla', 'Le gustan los jóvenes', 'Metódico', 'Apasionado',
  'Veterano del fútbol modesto', 'Recién titulado', 'Viene de otra liga', 'Muy trabajador', 'Algo polémico',
];

/** Sueldo base del entrenador de 1 estrella en cada división */
const BASE = [220_000, 90_000, 35_000, 12_000, 5_000];

export function makeStaffCandidates(s: GameState, division: number): Record<Role, Staff[]> {
  const out = {} as Record<Role, Staff[]>;
  for (const role of ROLE_ORDER) {
    // tres candidatos de calidades distintas
    const rasgos = shuffle([...RASGOS]);
    out[role] = [rand(1, 2.5), rand(2, 3.8), rand(3.2, 5)].map((x, i) => {
      const stars = Math.max(1, Math.min(5, Math.round(x)));
      return {
        id: s.nextId++,
        name: personName(),
        role,
        stars,
        salary: roundMoney(BASE[division] * ROLES[role].pay * Math.pow(1.85, stars - 1) * rand(0.9, 1.1)),
        trait: rasgos[i],
        ...(role === 'entrenador'
          ? {
              formation: pick(['4-4-2', '4-4-2', '4-3-3', '4-3-3', '4-5-1', '5-3-2', '3-5-2'] as Formation[]),
              style: pick(['equilibrado', 'equilibrado', 'ofensivo', 'defensivo', 'contraataque'] as Style[]),
              contract: randInt(1, 3),
              confidence: 60,
            }
          : {}),
      };
    });
  }
  return out;
}

export const staffStars = (s: GameState, r: Role) => s.club.staff[r]?.stars ?? 0;
export const staffWages = (s: GameState) => ROLE_ORDER.reduce((a, r) => a + (s.club.staff[r]?.salary ?? 0), 0);

/** Fuerza extra del once en un partido según el cuerpo técnico */
export function staffMatchBonus(s: GameState) {
  const e = staffStars(s, 'entrenador');
  let bonus = e ? e * 0.7 : -2;
  bonus += staffStars(s, 'segundo') * 0.3;
  if (s.matchday >= MATCHDAYS / 2) bonus += staffStars(s, 'preparador') * 0.35;
  else bonus += staffStars(s, 'preparador') * 0.1;
  return bonus;
}

export const youthGrowthBonus = (s: GameState) => 1 + 0.06 * staffStars(s, 'segundo');
export const staffAgingFactor = (s: GameState) => 1 - 0.1 * staffStars(s, 'fisio');
export const staffScoutFactor = (s: GameState) => 1 - 0.1 * staffStars(s, 'ojeador');
export const marketingSponsorBonus = (s: GameState) => 1 + 0.05 * staffStars(s, 'marketing');
export const marketingFansBonus = (s: GameState) => 1 + 0.015 * staffStars(s, 'marketing');

export function hireStaff(s: GameState, role: Role, id: number): string | undefined {
  const c = s.staffMarket[role]?.find((x) => x.id === id);
  if (!c) return 'Ese candidato ya no está disponible.';
  if (s.club.staff[role]) fireStaff(s, role);
  s.club.staff[role] = c;
  if (role === 'entrenador') {
    c.confidence = 60;
    c.warned = false;
    // a mitad de temporada, el cambio de entrenador da un empujón al vestuario
    if (s.phase === 'temporada' && s.matchday > 0) changeMorale(s, 6);
  }
  s.staffMarket[role] = s.staffMarket[role].filter((x) => x.id !== id);
  addMessage(s, { from: 'club', title: `${c.name}, nuevo ${ROLES[role].name.toLowerCase()}`, body: `${c.trait}. Sueldo: ${fmtMoney(c.salary)}/temporada.` });
}

/**
 * Indemnización por despido: al entrenador se le paga lo que le queda de contrato;
 * al resto, la mitad de lo que le queda de temporada.
 */
export function coachSeverance(s: GameState, e: Staff) {
  const restante = s.phase === 'temporada' ? 1 - s.matchday / MATCHDAYS : 1;
  if (e.role === 'entrenador' && e.contract) return roundMoney(e.salary * (restante + Math.max(0, e.contract - 1)));
  return roundMoney((e.salary * restante) / 2);
}

export function fireStaff(s: GameState, role: Role) {
  const e = s.club.staff[role];
  if (!e) return;
  const coste = coachSeverance(s, e);
  s.club.cash -= coste;
  s.club.ledger.personal += coste;
  delete s.club.staff[role];
  // si la grada ya pedía su cabeza, la destitución se celebra
  if (role === 'entrenador' && (e.confidence ?? 60) < 30) changeSatisfaction(s, 3, `Destitución de ${e.name}`);
  addMessage(s, { from: 'club', title: `Despedido ${e.name}`, body: `${ROLES[role].name}. Indemnización: ${fmtMoney(coste)}.` });
}

/** El jefe de ojeadores encuentra jóvenes promesas libres cada verano */
export function scoutDiscoveries(s: GameState, makeYoung: () => { name: string; pos: string; pot: number }) {
  const n = staffStars(s, 'ojeador');
  if (!n) return;
  const hallazgos = Array.from({ length: Math.ceil(n / 2) + 1 }, makeYoung);
  addMessage(s, {
    from: 'club',
    title: 'El jefe de ojeadores ha encontrado promesas',
    body:
      `Están libres en el mercado:\n` +
      hallazgos.map((p) => `• ${p.name} (${p.pos}, potencial ${p.pot})`).join('\n') +
      `\n\nBúscalos en Mercado → Solo libres.`,
  });
}
