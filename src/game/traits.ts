import type { Formation, Style } from './match';
import { chance, pick } from './rng';
import type { GameState, Player, Pos } from './types';

// Perfil de juego (cómo encaja cada jugador en el sistema del entrenador) y rasgos de personalidad.

export type Profile =
  | 'bajo_palos' | 'portero_pies'
  | 'contundente' | 'lateral' | 'salida'
  | 'pivote' | 'organizador' | 'todocampista' | 'extremo'
  | 'rematador' | 'rapido' | 'apoyo';

interface ProfileInfo {
  pos: Pos;
  name: string;
  /** +1 encaja bien, -1 encaja mal; lo que no aparece es neutro */
  style: Partial<Record<Style, 1 | -1>>;
  formation: Partial<Record<Formation, 1 | -1>>;
}

export const PROFILES: Record<Profile, ProfileInfo> = {
  bajo_palos: { pos: 'POR', name: 'Bajo palos', style: { defensivo: 1, ofensivo: -1 }, formation: {} },
  portero_pies: { pos: 'POR', name: 'Portero con pies', style: { ofensivo: 1, contraataque: -1 }, formation: { '3-5-2': 1 } },
  contundente: { pos: 'DEF', name: 'Central contundente', style: { defensivo: 1, ofensivo: -1 }, formation: { '5-3-2': 1 } },
  lateral: { pos: 'DEF', name: 'Lateral largo', style: { ofensivo: 1 }, formation: { '4-3-3': 1, '5-3-2': -1, '3-5-2': -1 } },
  salida: { pos: 'DEF', name: 'Defensa con salida', style: { equilibrado: 1, ofensivo: 1, contraataque: -1 }, formation: {} },
  pivote: { pos: 'MED', name: 'Pivote defensivo', style: { defensivo: 1, contraataque: 1, ofensivo: -1 }, formation: {} },
  organizador: { pos: 'MED', name: 'Organizador', style: { equilibrado: 1, contraataque: -1 }, formation: { '4-5-1': 1, '3-5-2': 1 } },
  todocampista: { pos: 'MED', name: 'Todocampista', style: {}, formation: {} },
  extremo: { pos: 'MED', name: 'Extremo', style: { ofensivo: 1 }, formation: { '4-4-2': 1, '4-3-3': 1, '5-3-2': -1 } },
  rematador: { pos: 'DEL', name: 'Rematador de área', style: { ofensivo: 1 }, formation: { '4-4-2': 1, '5-3-2': 1, '4-5-1': -1 } },
  rapido: { pos: 'DEL', name: 'Delantero rápido', style: { contraataque: 1, defensivo: -1 }, formation: { '4-3-3': 1 } },
  apoyo: { pos: 'DEL', name: 'Delantero de apoyo', style: { equilibrado: 1 }, formation: { '4-5-1': 1 } },
};

export const profilesFor = (pos: Pos) => (Object.keys(PROFILES) as Profile[]).filter((k) => PROFILES[k].pos === pos);

export type Trait = 'lider' | 'profesional' | 'fragil' | 'conflictivo' | 'idolo' | 'ambicioso' | 'fiel' | 'polivalente';

export const TRAITS: Record<Trait, { name: string; icon: string; help: string }> = {
  lider: { name: 'Líder', icon: '👑', help: 'Tira del vestuario: tras una derrota, la moral cae menos.' },
  profesional: { name: 'Profesional', icon: '🧘', help: 'Se cuida: envejece más despacio y se lesiona menos.' },
  fragil: { name: 'Frágil', icon: '🩹', help: 'Se lesiona con facilidad.' },
  conflictivo: { name: 'Conflictivo', icon: '😤', help: 'Si no juega, protesta y enrarece el vestuario. Rechazar una oferta por él sienta peor.' },
  idolo: { name: 'Ídolo de la afición', icon: '🙌', help: 'Vende camisetas en cada partido, pero venderlo enfada a la grada.' },
  ambicioso: { name: 'Ambicioso', icon: '🦅', help: 'Pide más al renovar y los clubes grandes se fijan antes en él; quiere dar el salto.' },
  fiel: { name: 'Fiel al club', icon: '💙', help: 'Renueva más barato, nunca fuerza su salida y le basta con 40 partidos para el homenaje.' },
  polivalente: { name: 'Polivalente', icon: '🔀', help: 'Se adapta a cualquier sistema: nunca encaja mal.' },
};

/** Rasgos incompatibles entre sí */
const CHOQUES: [Trait, Trait][] = [['profesional', 'fragil'], ['fiel', 'ambicioso'], ['lider', 'conflictivo']];
const SORTEO: Trait[] = ['lider', 'profesional', 'profesional', 'fragil', 'conflictivo', 'ambicioso', 'ambicioso', 'fiel', 'fiel', 'polivalente', 'polivalente'];

export const hasTrait = (p: Player, t: Trait) => Boolean(p.traits?.includes(t));

/** Perfil y rasgos de un jugador nuevo (o de partidas antiguas que no los tenían) */
export function rollIdentity(p: Player) {
  p.profile ??= pick(profilesFor(p.pos));
  if (p.traits) return;
  const n = chance(0.12) ? 2 : chance(0.4) ? 1 : 0;
  const traits: Trait[] = [];
  while (traits.length < n) {
    const t = pick(SORTEO);
    if (traits.includes(t) || CHOQUES.some(([a, b]) => (t === a && traits.includes(b)) || (t === b && traits.includes(a)))) continue;
    traits.push(t);
  }
  p.traits = traits;
}

export type Fit = 1 | 0 | -1;

/** ¿Encaja el jugador con este sistema? */
export function fitOf(p: Player, formation: Formation, style: Style): Fit {
  const info = p.profile ? PROFILES[p.profile] : undefined;
  if (!info) return 0;
  const v = Math.max(-1, Math.min(1, (info.style[style] ?? 0) + (info.formation[formation] ?? 0))) as Fit;
  return v < 0 && hasTrait(p, 'polivalente') ? 0 : v;
}

/** Partidos con el mismo entrenador para adaptarse del todo a un sistema que no le va */
export const ADAPT_APPS = 15;
export const FIT_GOOD = 2;
export const FIT_BAD = 3;

/** Lo que suma o resta el encaje al rendimiento: +2, 0 o de -3 a -1 según lo adaptado que esté */
export function fitBonus(p: Player, formation: Formation, style: Style, coachId: number) {
  const f = fitOf(p, formation, style);
  if (f >= 0) return f * FIT_GOOD;
  const partidos = p.adapt?.coach === coachId ? p.adapt.apps : 0;
  return -FIT_BAD + Math.min(1, partidos / ADAPT_APPS) * 2;
}

/** Progreso de adaptación (0-1) de un jugador que no encaja */
export const adaptProgress = (p: Player, coachId: number) => Math.min(1, (p.adapt?.coach === coachId ? p.adapt.apps : 0) / ADAPT_APPS);

/** Los titulares suman un partido más con el entrenador actual */
export function adaptAfterMatch(s: GameState, ids: number[]) {
  const coach = s.club.staff.entrenador?.id ?? 0;
  for (const id of ids) {
    const p = s.players.find((x) => x.id === id);
    if (!p) continue;
    if (p.adapt?.coach !== coach) p.adapt = { coach, apps: 0 };
    p.adapt.apps++;
  }
}

export const FIT_ICON: Record<Fit, string> = { 1: '✅', 0: '➖', [-1]: '❌' };

/** Texto con lo que le va y lo que no a un perfil */
export function profileHelp(pr: Profile) {
  const info = PROFILES[pr];
  const nombre = (k: string) => (k.includes('-') ? k : k === 'contraataque' ? 'contraataque' : k);
  const bien = [...Object.entries(info.style), ...Object.entries(info.formation)].filter(([, v]) => v > 0).map(([k]) => nombre(k));
  const mal = [...Object.entries(info.style), ...Object.entries(info.formation)].filter(([, v]) => v < 0).map(([k]) => nombre(k));
  if (!bien.length && !mal.length) return 'Rinde igual en cualquier sistema.';
  return [bien.length ? `Le va: ${bien.join(', ')}` : '', mal.length ? `No le va: ${mal.join(', ')}` : ''].filter(Boolean).join(' · ');
}

/** Tras cada partido nuestro: los conflictivos que se quedan fuera pueden protestar */
export function conflictAfterMatch(s: GameState, xiIds: number[], onMorale: (d: number) => void, onMessage: (title: string, body: string) => void) {
  const titulares = new Set(xiIds);
  for (const p of s.players) {
    if (p.teamId !== s.club.teamId || p.youth || titulares.has(p.id) || (p.injury ?? 0) > 0) continue;
    if (!hasTrait(p, 'conflictivo') || !chance(0.12)) continue;
    onMorale(-2);
    onMessage(`😤 ${p.name} protesta por su suplencia`, 'Se ha quejado delante de todo el vestuario. La moral se resiente.');
  }
}

/** Fin de temporada: los que llevan años rindiendo en el club se ganan a la grada */
export function newIdols(s: GameState, onMessage: (title: string, body: string) => void) {
  for (const p of s.players) {
    if (p.teamId !== s.club.teamId || hasTrait(p, 'idolo')) continue;
    const h = s.club.records.players[p.id];
    if (!h || (h.apps < 80 && h.goals < 30) || !chance(0.5)) continue;
    p.traits = [...(p.traits ?? []), 'idolo'];
    onMessage(`🙌 ${p.name}, ídolo de la afición`, `${h.apps} partidos y ${h.goals} goles con nosotros: su camiseta es la más vendida. Venderlo ahora enfadaría a la grada.`);
  }
}

export const idolCount = (s: GameState) => s.players.filter((p) => p.teamId === s.club.teamId && hasTrait(p, 'idolo')).length;
