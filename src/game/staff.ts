import { DIV_FANS, MATCHDAYS, fmtMoney, roundMoney } from './economy';
import { addMessage } from './market';
import { personName } from './names';
import { changeSatisfaction } from './fans';
import type { Formation, Style } from './match';
import { changeMorale } from './morale';
import { chance, clamp, pick, rand, randInt, shuffle } from './rng';
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
  entrenador: { name: 'Entrenador', icon: '🧢', pay: 1, help: 'Dirige al equipo: su sistema y su estilo son los que se juegan.' },
  segundo: { name: 'Segundo entrenador', icon: '📋', pay: 0.5, help: 'Ayuda al entrenador y trabaja con los jóvenes.' },
  preparador: { name: 'Preparador físico', icon: '🏃', pay: 0.45, help: 'Se encarga de la forma física de la plantilla.' },
  fisio: { name: 'Fisioterapeuta', icon: '💆', pay: 0.4, help: 'Cuida a los jugadores, sobre todo a los veteranos.' },
  ojeador: { name: 'Jefe de ojeadores', icon: '🔭', pay: 0.5, help: 'Hace informes de jugadores de otros clubes y busca jóvenes promesas. Ayuda a tu director a acertar.' },
  marketing: { name: 'Responsable de marketing', icon: '📣', pay: 0.45, help: 'Patrocinios y crecimiento de la afición.' },
};

export const ROLE_ORDER = Object.keys(ROLES) as Role[];

const RASGOS = [
  'Muy exigente', 'Cercano con la plantilla', 'Le gustan los jóvenes', 'Metódico', 'Apasionado',
  'Veterano del fútbol modesto', 'Recién titulado', 'Viene de otra liga', 'Muy trabajador', 'Algo polémico',
];

/** Sueldo de referencia de un director deportivo según sus estrellas: el mismo en cualquier categoría */
export const DIRECTOR_PAY = [10_000, 25_000, 60_000, 160_000, 450_000];
/** Sueldo de referencia de un empleado (el del entrenador; el resto, según el peso de su puesto) */
export const staffPay = (role: Role, stars: number) => roundMoney(DIRECTOR_PAY[clamp(stars, 1, 5) - 1] * 0.6 * ROLES[role].pay);

/** Prestigio extra del club: mucha afición para su categoría o una buena vitrina */
export function prestigeBonus(s: GameState) {
  const t = s.teams?.find((x) => x.id === s.club?.teamId);
  if (!t) return 0;
  return (t.fans >= DIV_FANS[t.division] * 1.5 ? 0.5 : 0) + ((s.club.trophies?.length ?? 0) >= 3 ? 0.5 : 0);
}

/** Estrellas máximas de los que aceptan venir: en la Liga Comarcal, 2; en Primera, 5 */
export const maxStarsFor = (division: number, bonus = 0) => clamp(Math.floor(2 + (4 - division) * 0.75 + bonus), 2, 5);
export const clubMaxStars = (s: GameState) => maxStarsFor(s.teams.find((t) => t.id === s.club.teamId)!.division, prestigeBonus(s));

/** Estrellas de n candidatos, repartidas hasta el máximo; a veces uno de más nivel apuesta por el proyecto */
export function candidateStars(n: number, max: number) {
  const min = Math.max(1, max - 3);
  const out = Array.from({ length: n }, (_, i) => (n === 1 ? max : Math.round(min + (i * (max - min)) / (n - 1))));
  if (chance(0.3)) out[n - 1] = Math.min(5, max + 1);
  return out;
}

/** ¿Renovaría? Si el club se le ha quedado muy pequeño, no */
export const refusesRenewal = (s: GameState, stars: number) => stars >= clubMaxStars(s) + 2;

/** Lo que pide por renovar 2 temporadas: algo más de lo que cobra y, al menos, lo que vale */
export function renewalSalary(salary: number, reference: number, stars: number) {
  return roundMoney(Math.max(salary * (1.05 + 0.03 * stars), reference));
}

export function makeStaffCandidates(s: GameState, division: number): Record<Role, Staff[]> {
  const out = {} as Record<Role, Staff[]>;
  for (const role of ROLE_ORDER) {
    // tres candidatos de calidades distintas
    const rasgos = shuffle([...RASGOS]);
    const max = s.club ? clubMaxStars(s) : maxStarsFor(division);
    out[role] = candidateStars(3, max).map((stars, i) => {
      return {
        id: s.nextId++,
        name: personName(),
        role,
        stars,
        salary: roundMoney(staffPay(role, stars) * rand(0.9, 1.1)),
        contract: randInt(1, 3),
        trait: rasgos[i],
        ...(role === 'entrenador'
          ? {
              formation: pick(['4-4-2', '4-4-2', '4-3-3', '4-3-3', '4-5-1', '5-3-2', '3-5-2'] as Formation[]),
              style: pick(['equilibrado', 'equilibrado', 'ofensivo', 'defensivo', 'contraataque'] as Style[]),
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
  if (c.trait === 'Leyenda del club') changeSatisfaction(s, 2, `${c.name} vuelve al club`);
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
      hallazgos.map((p) => `• ${p.name} (${p.pos})`).join('\n') +
      `\n\nBúscalos en Mercado → Solo libres.`,
  });
}

/** Renueva 2 temporadas a un empleado (el entrenador tiene su propia renovación) */
export function renewStaff(s: GameState, role: Role): string | undefined {
  const c = s.club.staff[role];
  if (!c) return 'No hay nadie en ese puesto.';
  if (refusesRenewal(s, c.stars)) return `${c.name} busca un club de más nivel y no quiere renovar.`;
  c.salary = renewalSalary(c.salary, staffPay(role, c.stars), c.stars);
  c.contract = (c.contract ?? 1) + 2;
  addMessage(s, { from: 'club', title: `✍️ ${c.name} renueva`, body: `${ROLES[role].name}: 2 temporadas más por ${fmtMoney(c.salary)}/temp.` });
}

/** Fin de temporada de los empleados (salvo el entrenador): corre el contrato y se van los que acaban */
export function staffEndSeason(s: GameState) {
  const seVan: string[] = [];
  for (const role of ROLE_ORDER) {
    if (role === 'entrenador') continue;
    const c = s.club.staff[role];
    if (!c) continue;
    c.contract = (c.contract ?? 2) - 1;
    if (c.contract > 0) continue;
    // con los empleados delegados en automático, el director renueva a quien quiera quedarse
    if (s.club.director && s.club.delegation.empleados === 'auto' && !refusesRenewal(s, c.stars) && !renewStaff(s, role)) continue;
    delete s.club.staff[role];
    seVan.push(`${c.name} (${ROLES[role].name.toLowerCase()})`);
  }
  if (seVan.length) {
    addMessage(s, { from: 'club', title: `👋 Acaban contrato y se van: ${seVan.length}`, body: `${seVan.join(', ')}. Busca sustitutos en Dirección → Empleados.` });
  }
}
