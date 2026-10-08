import { DIV_LEVEL, fmtMoney, playerValue, roundMoney } from './economy';
import { addMessage, marketOpen, myTeam, mySquad } from './market';
import { negFor, newSaleOffer } from './negotiation';
import { pick, rand, chance } from './rng';
import { hasTrait } from './traits';
import type { GameState, Player } from './types';

// Ofertas de otros clubes por nuestros jugadores. Cada una abre una negociación de venta.

const MAX_ACTIVAS = 3;

/** Club que podría estar interesado: de una categoría acorde a su nivel, mejor si es superior a la nuestra */
function buyerFor(s: GameState, p: Player) {
  const mia = myTeam(s).division;
  const divs = DIV_LEVEL.map((lvl, d) => ({ d, dif: lvl - p.ovr })).filter((x) => x.dif <= 4 && x.dif >= -9).map((x) => x.d);
  if (!divs.length) return undefined;
  // preferimos categorías iguales o superiores a la nuestra
  const arriba = divs.filter((d) => d <= mia);
  const d = pick(arriba.length ? arriba : divs);
  return pick(s.teams.filter((t) => t.division === d && t.id !== s.club.teamId));
}

/** Llegan ofertas nuevas (como mucho `max`); los transferibles llaman mucho más la atención */
export function generateOffers(s: GameState, max: number) {
  if (!marketOpen(s)) return;
  const activas = s.negotiations.filter((n) => n.kind === 'venta' && (n.state === 'esperando' || n.state === 'tu_turno')).length;
  if (activas >= MAX_ACTIVAS) return;
  const nivel = DIV_LEVEL[myTeam(s).division];
  // nadie hace ofertas por quien acaba de llegar (salvo que lo pongamos como transferible)
  const disponibles = mySquad(s).filter((p) => !negFor(s, p.id) && (p.injury ?? 0) < 5 && !p.retiring && !p.loan && (p.listed || p.signedSeason !== s.season));
  const candidatos = [...disponibles.filter((p) => p.listed), ...disponibles.filter((p) => !p.listed).sort((a, b) => b.ovr - a.ovr).slice(0, 8)];
  let nuevas = 0;
  for (const p of candidatos) {
    if (nuevas >= max || activas + nuevas >= MAX_ACTIVAS) break;
    // los que destacan en su categoría y los que encadenan buenas notas llaman más la atención
    const media = p.form?.length ? p.form.reduce((a, n) => a + n, 0) / p.form.length : 6;
    const interes =
      0.15 + Math.max(0, p.ovr - nivel) * 0.05 + (p.age <= 23 ? 0.1 : 0) + Math.max(0, media - 6.5) * 0.15 +
      (hasTrait(p, 'ambicioso') ? 0.1 : 0) + (p.listed ? 0.4 : 0);
    if (!chance(Math.min(0.8, interes))) continue;
    const comprador = buyerFor(s, p);
    if (!comprador) continue;
    const valor = playerValue(p);
    const sube = comprador.division < myTeam(s).division;
    // por un transferible ofrecen algo menos: saben que lo quieres vender
    const rebaja = p.listed ? 0.85 : 1;
    const fee = roundMoney(valor * rand(0.75, 1.1) * (sube ? 1.1 : 1) * rebaja);
    const maxFee = roundMoney(valor * rand(0.95, 1.4) * (sube ? 1.1 : 1) * rebaja);
    const quiereIrse = !hasTrait(p, 'fiel') && (sube || (hasTrait(p, 'ambicioso') && comprador.division <= myTeam(s).division));
    newSaleOffer(s, p, comprador.id, fee, Math.max(fee, maxFee), quiereIrse);
    nuevas++;
    addMessage(s, {
      from: 'club',
      title: `📨 Oferta por ${p.name}: ${fmtMoney(fee)}`,
      body:
        `${comprador.name} (${comprador.division + 1}ª) quiere a ${p.name} (${p.pos}, ${p.ovr}).` +
        (quiereIrse ? ' Al jugador le seduce dar el salto.' : '') +
        '\nResponde en Equipo → Mercado: si tardas, pueden retirarla.',
    });
  }
}
