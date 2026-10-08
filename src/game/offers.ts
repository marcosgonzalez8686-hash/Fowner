import { DIV_LEVEL, fmtMoney, roundMoney } from './economy';
import { addMessage, marketOpen, marketValue, myTeam, mySquad } from './market';
import { directorSells, negFor, newSaleOffer } from './negotiation';
import { COUNTRIES, countryName, flagOf, worldTeams } from './world';
import { pick, rand, chance } from './rng';
import { hasTrait } from './traits';
import type { GameState, Player } from './types';

// Ofertas de otros clubes por nuestros jugadores. Cada una abre una negociación de venta.

const MAX_ACTIVAS = 3;

/** Club que podría estar interesado: de una categoría acorde a su nivel, mejor si es superior a la nuestra */
function buyerFor(s: GameState, p: Player, amplio = false) {
  const mia = myTeam(s).division;
  // para un transferible el director busca más lejos: también clubes donde sería suplente o de la última categoría
  const divs = DIV_LEVEL.map((lvl, d) => ({ d, dif: lvl - p.ovr })).filter((x) => x.dif <= (amplio ? 10 : 4) && x.dif >= -9).map((x) => x.d);
  if (!divs.length && amplio) divs.push(DIV_LEVEL.length - 1);
  if (!divs.length) return undefined;
  // preferimos categorías iguales o superiores a la nuestra
  const arriba = divs.filter((d) => d <= mia);
  const d = pick(arriba.length ? arriba : divs);
  // a los que tienen nivel de Primera también los quieren en el extranjero
  if (d === 0 && Math.random() < 0.4) {
    const fuera = worldTeams(s).filter((t) => Math.abs(COUNTRIES[t.country!].level! - p.ovr) <= 8);
    if (fuera.length) return pick(fuera);
  }
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
      (hasTrait(p, 'ambicioso') ? 0.1 : 0) + (p.listed ? 0.4 : 0) + (p.unhappy ? 0.2 : 0);
    if (!chance(Math.min(0.8, interes))) continue;
    const comprador = buyerFor(s, p, p.listed);
    if (!comprador) continue;
    const valor = marketValue(s, p);
    const sube = comprador.division < myTeam(s).division;
    // por un transferible ofrecen algo menos: saben que lo quieres vender
    const rebaja = p.listed ? 0.85 : 1;
    const fee = roundMoney(valor * rand(0.75, 1.1) * (sube ? 1.1 : 1) * rebaja);
    const maxFee = roundMoney(valor * rand(0.95, 1.4) * (sube ? 1.1 : 1) * rebaja);
    const quiereIrse = Boolean(p.unhappy) || (!hasTrait(p, 'fiel') && (sube || (hasTrait(p, 'ambicioso') && comprador.division <= myTeam(s).division)));
    newSaleOffer(s, p, comprador.id, fee, Math.max(fee, maxFee), quiereIrse);
    nuevas++;
    addMessage(s, {
      from: 'club',
      title: `📨 Oferta por ${p.name}: ${fmtMoney(fee)}`,
      body:
        `${comprador.name} (${comprador.country ? `${flagOf(comprador.country)} ${countryName(comprador.country)}` : `${comprador.division + 1}ª`}) quiere a ${p.name} (${p.pos}, ${p.ovr}).` +
        (quiereIrse ? ' Al jugador le seduce dar el salto.' : '') +
        (directorSells(s, p) ? '\nLa negocia tu director deportivo: te pedirá el visto bueno si hay acuerdo.' : '\nResponde en Equipo → Mercado: si tardas, pueden retirarla.'),
    });
  }
}

/** El director busca comprador para los transferibles (también con el mercado cerrado: la venta se haría en el siguiente) */
export function directorShopsListed(s: GameState) {
  const d = s.club.director;
  if (!d) return;
  const listados = mySquad(s).filter((p) => p.listed && !negFor(s, p.id) && !p.loan && !p.retiring);
  for (const p of listados.slice(0, 2)) {
    // un buen director tiene más contactos
    if (!chance(0.3 + d.stars * 0.06)) continue;
    const comprador = buyerFor(s, p, true);
    if (!comprador) continue;
    const valor = marketValue(s, p);
    const fee = roundMoney(valor * rand(0.7, 0.95));
    const maxFee = roundMoney(valor * rand(0.9, 1.2));
    newSaleOffer(s, p, comprador.id, fee, Math.max(fee, maxFee), !hasTrait(p, 'fiel'));
    addMessage(s, {
      from: 'director',
      title: `Oferta por ${p.name}: he encontrado comprador`,
      body: `He movido a ${p.name} entre los clubes y el ${comprador.name} (${comprador.country ? `${flagOf(comprador.country)} ${countryName(comprador.country)}` : `${comprador.division + 1}ª`}) ofrece ${fmtMoney(fee)}. Negocio yo y te pido el visto bueno si cerramos.`,
    });
  }
}
