import { DIV_FANS } from './economy';
import { diff } from './difficulty';
import { makePlayer } from './generate';
import { bestEleven, chooseStyle, computeStandings, roundRobin, simulate } from './match';
import { foreignClubs } from './places';
import { ensureFacilities } from './rivals';
import { gauss, pick, rand, randInt } from './rng';
import { tire } from './fatigue';
import type { Fixture, GameState, Player, Pos, Team } from './types';

// El resto del mundo: ligas de primera división de otros países (clubes ficticios),
// y la nacionalidad de los jugadores (para las selecciones y para fichar fuera).

export interface CountryInfo {
  name: string;
  flag: string;
  /** nivel medio de su primera división (la española ronda 76) */
  level?: number;
}

export const COUNTRIES: Record<string, CountryInfo> = {
  ESP: { name: 'España', flag: '🇪🇸' },
  ENG: { name: 'Inglaterra', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', level: 78 },
  ITA: { name: 'Italia', flag: '🇮🇹', level: 76 },
  GER: { name: 'Alemania', flag: '🇩🇪', level: 76 },
  FRA: { name: 'Francia', flag: '🇫🇷', level: 74 },
  POR: { name: 'Portugal', flag: '🇵🇹', level: 71 },
  NED: { name: 'Países Bajos', flag: '🇳🇱', level: 70 },
  BEL: { name: 'Bélgica', flag: '🇧🇪' },
  BRA: { name: 'Brasil', flag: '🇧🇷' },
  ARG: { name: 'Argentina', flag: '🇦🇷' },
};

/** Países con liga propia en el juego (además de España) */
export const FOREIGN = ['ENG', 'ITA', 'GER', 'FRA', 'POR', 'NED'] as const;
export const NATIONS = Object.keys(COUNTRIES);
export const FOREIGN_TEAMS = 18;

export const flagOf = (code?: string) => (code ? COUNTRIES[code]?.flag ?? '' : '');
export const countryName = (code?: string) => (code ? COUNTRIES[code]?.name ?? code : '');
export const leagueName = (code: string) => `Primera de ${countryName(code)}`;

/** Nacionalidad de un jugador nuevo: la mayoría del país del club, el resto de cualquier otro */
export function randomNat(home: string, share: number) {
  if (Math.random() < share) return home;
  return pick(NATIONS.filter((n) => n !== home));
}

export interface ForeignLeague {
  country: string;
  teams: Team[];
  fixtures: Fixture[][];
  lastTable?: number[]; // clasificación final de la temporada pasada (ids)
}

// plantilla de los clubes extranjeros: 20 jugadores
const PLANTILLA_FUERA: Pos[] = ['POR', 'POR', 'DEF', 'DEF', 'DEF', 'DEF', 'DEF', 'DEF', 'DEF', 'MED', 'MED', 'MED', 'MED', 'MED', 'MED', 'MED', 'DEL', 'DEL', 'DEL', 'DEL'];

function foreignPlayer(s: GameState, team: Team, level: number, pos: Pos, opts: Partial<Player> = {}) {
  return makePlayer(s, level, { pos, teamId: team.id, nat: randomNat(team.country!, 0.7), ...opts });
}

/** Crea las ligas extranjeras con sus clubes y plantillas */
export function createWorld(s: GameState) {
  s.world = { leagues: [] };
  for (const code of FOREIGN) {
    const nivel = COUNTRIES[code].level! + diff(s).rival;
    const teams: Team[] = foreignClubs(code, FOREIGN_TEAMS).map((c, i) => ({
      id: s.nextId++,
      name: c.name,
      short: c.short,
      division: 0,
      country: code,
      // unos pocos grandes y el resto más igualado
      fans: Math.round(DIV_FANS[0] * (i < 3 ? rand(1.8, 2.6) : rand(0.5, 1.4))),
    }));
    teams.forEach((t, i) => {
      const fuerza = nivel + (i < 3 ? rand(3, 7) : rand(-5, 2));
      for (const pos of PLANTILLA_FUERA) s.players.push(foreignPlayer(s, t, fuerza, pos));
    });
    ensureFacilities(teams);
    s.world.leagues.push({ country: code, teams, fixtures: roundRobin(teams.map((t) => t.id)) });
  }
}

export const worldTeams = (s: GameState): Team[] => s.world?.leagues.flatMap((l) => l.teams) ?? [];
export const leagueOfTeam = (s: GameState, teamId: number) => s.world?.leagues.find((l) => l.teams.some((t) => t.id === teamId));
export const leagueTable = (l: ForeignLeague) => computeStandings(l.teams.map((t) => t.id), l.fixtures);

/** Juega la jornada de las ligas extranjeras (34 jornadas: las últimas de la nuestra no tienen partido fuera) */
export function playWorldMatchday(s: GameState, md: number, porEquipo: Map<number, Player[]>) {
  for (const l of s.world?.leagues ?? []) {
    for (const f of l.fixtures[md] ?? []) {
      const h = bestEleven(porEquipo.get(f.home) ?? []);
      const a = bestEleven(porEquipo.get(f.away) ?? []);
      const fh = h.strength + 2 + gauss(0, 2);
      const fa = a.strength + gauss(0, 2);
      const r = simulate(fh, fa, chooseStyle(h.strength, a.strength, true), chooseStyle(a.strength, h.strength, false));
      f.hg = r.hg;
      f.ag = r.ag;
      tire(s, [...h.xi, ...a.xi]);
    }
  }
}

/** Fin de temporada: se guarda la clasificación, se completan las plantillas y se hace el calendario nuevo */
export function worldEndSeason(s: GameState) {
  for (const l of s.world?.leagues ?? []) {
    l.lastTable = leagueTable(l).map((r) => r.teamId);
    const nivel = COUNTRIES[l.country].level! + diff(s).rival;
    l.lastTable.forEach((id, puesto) => {
      const t = l.teams.find((x) => x.id === id)!;
      const plantilla = s.players.filter((p) => p.teamId === id);
      // los de arriba refuerzan algo mejor
      const fuerza = nivel + (puesto < 3 ? rand(3, 6) : puesto < 9 ? rand(-1, 3) : rand(-5, 1));
      // se completa cada puesto hasta lo que pide la plantilla
      for (const pos of ['POR', 'DEF', 'MED', 'DEL'] as Pos[]) {
        const faltan = PLANTILLA_FUERA.filter((x) => x === pos).length - plantilla.filter((p) => p.pos === pos).length;
        for (let i = 0; i < faltan; i++) {
          const joven = Math.random() < 0.3;
          s.players.push(foreignPlayer(s, t, joven ? fuerza - 5 : fuerza, pos, joven ? { age: randInt(17, 20) } : { contract: randInt(1, 4) }));
        }
      }
    });
    l.fixtures = roundRobin(l.teams.map((t) => t.id));
  }
}
