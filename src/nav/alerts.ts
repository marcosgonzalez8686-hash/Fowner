import type { TabId } from '../App';
import { MATCHDAYS } from '../game/economy';
import { marketOpen, myYouth } from '../game/market';
import type { GameState, Message } from '../game/types';

// Avisos en las pestañas: un número si hay algo que decidir, un punto si hay novedades.

export function tabAlerts(s: GameState) {
  const coach = s.club.staff.entrenador;
  const ofertas = s.incomingOffers.length;
  const juveniles = s.phase === 'pretemporada' ? myYouth(s).length : 0;
  const empleados =
    (coach ? 0 : 1) +
    (coach && (coach.confidence ?? 60) < 30 ? 1 : 0) +
    (coach && coach.contract === 1 && s.phase === 'temporada' && s.matchday >= MATCHDAYS - 8 ? 1 : 0);
  const patrocinio = Object.values(s.sponsorOffers).filter((o) => o?.length).length;
  const banca = s.club.cash < 0 ? 1 : 0;
  const sub: Record<string, number> = { mercado: ofertas, plantilla: juveniles, empleados, patrocinadores: patrocinio, banca };
  const tab: Partial<Record<TabId, number>> = {
    equipo: ofertas + juveniles,
    direccion: empleados,
    finanzas: patrocinio + banca,
  };
  // punto: hay algo nuevo aunque no obligue a decidir
  const dot: Partial<Record<TabId, boolean>> = { equipo: marketOpen(s) };
  return { tab, sub, dot };
}

/** Mensajes que merecen el aviso del buzón (el resto se leen cuando se quiera) */
const IMPORTANTE = /^(🏆|🥇|🏅|🌍|🔥|👴|📨|🎖️|🙌|💎|⚠️|😤|😒|👋|🧢|📈|👟|💪|🎉|😞|🚨|💸|🏦)/u;
export const isImportant = (m: Message) =>
  m.from === 'director' ? !/^(Hecho|Oferta por|He renovado)/.test(m.title) : IMPORTANTE.test(m.title);
