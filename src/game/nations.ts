import { penalties } from './cup';
import { changeSatisfaction } from './fans';
import { addMessage, mySquad } from './market';
import { bestEleven, simulate } from './match';
import { changeMorale } from './morale';
import { chance, gauss, randInt, shuffle } from './rng';
import type { GameState, Player, Pos } from './types';
import { COUNTRIES, NATIONS, countryName, flagOf } from './world';

// Selecciones nacionales: absoluta, sub-21 y sub-19. Convocatorias en los parones de la liga
// y torneos en verano (Mundial o Eurocopa, Europeo sub-21 y Europeo sub-19).

export type NatCat = 'abs' | 'u21' | 'u19';
export const CATS: Record<NatCat, { name: string; maxAge?: number }> = {
  abs: { name: 'Absoluta' },
  u21: { name: 'Sub-21', maxAge: 21 },
  u19: { name: 'Sub-19', maxAge: 19 },
};
export const CAT_KEYS: NatCat[] = ['abs', 'u21', 'u19'];
/** Parones de selecciones: tras estas jornadas de liga */
export const WINDOWS = [9, 19, 29];
const CONVOCATORIA: Record<Pos, number> = { POR: 3, DEF: 8, MED: 8, DEL: 4 };
const EUROPEAS = ['ESP', 'ENG', 'ITA', 'GER', 'FRA', 'POR', 'NED', 'BEL'];

export interface NationsState {
  call?: { season: number; matchday: number; squads: Record<string, Record<NatCat, number[]>> };
  history: { season: number; name: string; champion: string; runnerUp: string }[];
}

export const natOf = (p: Player) => p.nat ?? 'ESP';

/** Los 23 mejores de un país en una categoría (por puestos) */
function convoca(s: GameState, code: string, cat: NatCat): Player[] {
  const max = CATS[cat].maxAge;
  const elegibles = s.players.filter((p) => natOf(p) === code && !p.youth && !p.retiring && (max === undefined || p.age <= max));
  return (Object.keys(CONVOCATORIA) as Pos[]).flatMap((pos) =>
    elegibles.filter((p) => p.pos === pos).sort((a, b) => b.ovr - a.ovr).slice(0, CONVOCATORIA[pos]),
  );
}

function convocaTodo(s: GameState) {
  const squads: Record<string, Record<NatCat, number[]>> = {};
  for (const code of NATIONS) {
    squads[code] = { abs: [], u21: [], u19: [] };
    // un jugador solo va con una selección: primero la absoluta, luego la sub-21
    const usados = new Set<number>();
    for (const cat of CAT_KEYS) {
      const lista = convoca(s, code, cat).filter((p) => !usados.has(p.id));
      lista.forEach((p) => usados.add(p.id));
      squads[code][cat] = lista.map((p) => p.id);
    }
  }
  return squads;
}

/** Parón de selecciones: convocatorias, partidos, cansancio y algún susto */
export function nationsWindow(s: GameState) {
  s.nations ??= { history: [] };
  const squads = convocaTodo(s);
  s.nations.call = { season: s.season, matchday: s.matchday, squads };
  const mios = new Set(mySquad(s).map((p) => p.id));
  const nuestros: string[] = [];
  const lesionados: string[] = [];
  for (const code of NATIONS) {
    for (const cat of CAT_KEYS) {
      for (const id of squads[code][cat]) {
        const p = s.players.find((x) => x.id === id);
        if (!p) continue;
        p.caps = { ...p.caps, [cat]: (p.caps?.[cat] ?? 0) + 2 };
        p.fatigue = Math.min(100, (p.fatigue ?? 0) + (cat === 'abs' ? 8 : 5));
        if (!mios.has(id)) continue;
        nuestros.push(`${p.name} (${flagOf(code)} ${CATS[cat].name.toLowerCase()})`);
        if (!(p.injury && p.injury > 0) && chance(0.03)) {
          p.injury = randInt(1, 3);
          lesionados.push(`${p.name} (${p.injury} j.)`);
        }
      }
    }
  }
  if (nuestros.length) {
    if (nuestros.some((x) => x.includes('absoluta'))) changeMorale(s, 1);
    addMessage(s, {
      from: 'prensa',
      title: `🌍 Convocados con sus selecciones: ${nuestros.length}`,
      body: `${nuestros.join(', ')}.` + (lesionados.length ? `\n🤕 Vuelven lesionados: ${lesionados.join(', ')}.` : '\nVuelven algo más cansados.'),
    });
  }
}

/** Fuerza de una selección: su mejor once */
const fuerza = (s: GameState, ids: number[]) => bestEleven(ids.map((id) => s.players.find((p) => p.id === id)).filter(Boolean) as Player[]).strength;

/** Torneo de 8 selecciones a eliminatoria (cuartos, semis y final) */
function torneo(s: GameState, nombre: string, paises: string[], cat: NatCat, squads: Record<string, Record<NatCat, number[]>>) {
  const f = new Map(paises.map((c) => [c, fuerza(s, squads[c][cat])]));
  let vivos = shuffle([...paises].sort((a, b) => f.get(b)! - f.get(a)!).slice(0, 8));
  let finalista = '';
  while (vivos.length > 1) {
    const siguientes: string[] = [];
    for (let i = 0; i < vivos.length; i += 2) {
      const [a, b] = [vivos[i], vivos[i + 1]];
      const fa = f.get(a)! + gauss(0, 2);
      const fb = f.get(b)! + gauss(0, 2);
      const r = simulate(fa, fb);
      const gana = r.hg !== r.ag ? (r.hg > r.ag ? a : b) : (() => { const p = penalties(fa, fb); return p.a > p.b ? a : b; })();
      if (vivos.length === 2) finalista = gana === a ? b : a;
      siguientes.push(gana);
    }
    vivos = siguientes;
  }
  s.nations!.history.unshift({ season: s.season, name: nombre, champion: vivos[0], runnerUp: finalista });
  s.nations!.history = s.nations!.history.slice(0, 30);
  return { champion: vivos[0], runnerUp: finalista };
}

/** Verano de selecciones: Mundial o Eurocopa, y los europeos sub-21 y sub-19 */
export function nationsSummer(s: GameState) {
  s.nations ??= { history: [] };
  const squads = convocaTodo(s);
  const mundial = s.season % 2 === 0;
  const torneos: [string, string[], NatCat][] = [
    [mundial ? 'Mundial' : 'Eurocopa', mundial ? NATIONS : EUROPEAS, 'abs'],
    ['Europeo Sub-21', EUROPEAS, 'u21'],
    ['Europeo Sub-19', EUROPEAS, 'u19'],
  ];
  const mios = new Set(mySquad(s).map((p) => p.id));
  const lineas: string[] = [];
  const campeones: string[] = [];
  for (const [nombre, paises, cat] of torneos) {
    const r = torneo(s, nombre, paises, cat, squads);
    lineas.push(`${nombre}: ${flagOf(r.champion)} ${countryName(r.champion)} campeona (final contra ${flagOf(r.runnerUp)} ${countryName(r.runnerUp)})`);
    for (const code of paises) for (const id of squads[code][cat]) {
      const p = s.players.find((x) => x.id === id);
      if (!p) continue;
      p.caps = { ...p.caps, [cat]: (p.caps?.[cat] ?? 0) + 3 };
      if (code === r.champion && mios.has(id)) campeones.push(`${p.name} (${nombre})`);
    }
  }
  if (campeones.length) {
    changeMorale(s, 3);
    changeSatisfaction(s, 1, 'Campeones con su selección');
  }
  addMessage(s, {
    from: 'prensa',
    title: `🌍 Verano de selecciones: ${flagOf(s.nations.history[2].champion)} ${s.nations.history[2].name}`,
    body: lineas.join('\n') + (campeones.length ? `\n\n🏆 ¡Campeones con su selección! ${campeones.join(', ')}.` : ''),
  });
}

/** Internacional con la absoluta: vale más */
export const capsBoost = (p: Player) => ((p.caps?.abs ?? 0) >= 10 ? 1.15 : (p.caps?.abs ?? 0) >= 2 ? 1.08 : 1);

export const allNations = () => NATIONS.map((code) => ({ code, ...COUNTRIES[code] }));
