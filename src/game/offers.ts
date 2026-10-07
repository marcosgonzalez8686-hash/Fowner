import { DIV_LEVEL, fmtMoney, playerValue, roundMoney } from './economy';
import { addMessage, marketOpen, myTeam, mySquad, sellPlayer, teamById } from './market';
import { changeMorale } from './morale';
import { chance, pick, rand } from './rng';
import type { GameState, Level, Player } from './types';
import { hasTrait } from './traits';

// Ofertas de otros clubes por nuestros jugadores, con negociación.

export interface IncomingOffer {
  id: number;
  playerId: number;
  teamId: number; // club comprador
  fee: number; // lo que ofrecen ahora
  maxFee: number; // lo máximo que pagarían (oculto)
  rounds: number; // veces que han mejorado la oferta
  wantsToLeave: boolean; // al jugador le apetece el cambio (club de más categoría)
}

const MAX_ACTIVAS = 3;

const top3 = (s: GameState) => new Set([...mySquad(s)].sort((a, b) => b.ovr - a.ovr).slice(0, 3).map((p) => p.id));

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

/** Llegan ofertas nuevas (como mucho `max`) */
export function generateOffers(s: GameState, max: number) {
  if (!marketOpen(s)) return;
  const activas = s.incomingOffers.length;
  if (activas >= MAX_ACTIVAS) return;
  const nivel = DIV_LEVEL[myTeam(s).division];
  const candidatos = [...mySquad(s)]
    .filter((p) => !s.incomingOffers.some((o) => o.playerId === p.id) && (p.injury ?? 0) < 5 && !p.retiring && !p.loan)
    .sort((a, b) => b.ovr - a.ovr)
    .slice(0, 8);
  let nuevas = 0;
  for (const p of candidatos) {
    if (nuevas >= max || activas + nuevas >= MAX_ACTIVAS) break;
    // los que destacan en su categoría y los que encadenan buenas notas llaman más la atención
    const media = p.form?.length ? p.form.reduce((a, n) => a + n, 0) / p.form.length : 6;
    const interes = 0.15 + Math.max(0, p.ovr - nivel) * 0.05 + (p.age <= 23 ? 0.1 : 0) + Math.max(0, media - 6.5) * 0.15 + (hasTrait(p, 'ambicioso') ? 0.1 : 0);
    if (!chance(Math.min(0.7, interes))) continue;
    const comprador = buyerFor(s, p);
    if (!comprador) continue;
    const valor = playerValue(p);
    const sube = comprador.division < myTeam(s).division;
    const oferta: IncomingOffer = {
      id: s.nextId++,
      playerId: p.id,
      teamId: comprador.id,
      fee: roundMoney(valor * rand(0.75, 1.1) * (sube ? 1.1 : 1)),
      maxFee: roundMoney(valor * rand(0.95, 1.4) * (sube ? 1.1 : 1)),
      rounds: 0,
      // el ambicioso quiere irse a cualquier club que suba de nivel o le dé minutos; el fiel nunca fuerza
      wantsToLeave: !hasTrait(p, 'fiel') && (sube || (hasTrait(p, 'ambicioso') && comprador.division <= myTeam(s).division)),
    };
    s.incomingOffers.push(oferta);
    nuevas++;
    addMessage(s, {
      from: 'club',
      title: `📨 Oferta por ${p.name}: ${fmtMoney(oferta.fee)}`,
      body:
        `${comprador.name} (${comprador.division + 1}ª) quiere a ${p.name} (${p.pos}, ${p.ovr}).` +
        (sube ? ' Al jugador le seduce dar el salto.' : '') +
        '\nResponde en Equipo → Mercado.',
    });
  }
}

/** Al cerrarse el mercado, las ofertas pendientes caducan */
export function expireOffers(s: GameState) {
  if (!s.incomingOffers.length) return;
  s.incomingOffers = [];
  addMessage(s, { from: 'club', title: 'Ofertas caducadas', body: 'Se ha cerrado el mercado y las ofertas que no respondiste han caducado.' });
}

const find = (s: GameState, id: number) => s.incomingOffers.find((o) => o.id === id);
const remove = (s: GameState, id: number) => (s.incomingOffers = s.incomingOffers.filter((o) => o.id !== id));

export function acceptOffer(s: GameState, id: number): string {
  const o = find(s, id);
  if (!o) return 'La oferta ya no está.';
  const p = s.players.find((x) => x.id === o.playerId);
  const t = teamById(s, o.teamId)!;
  if (mySquad(s).length <= 16) return 'No puedes quedarte con menos de 16 jugadores.';
  const r = sellPlayer(s, o.playerId, o.fee, o.teamId);
  remove(s, id);
  if (!r.ok) return r.error ?? 'No se pudo cerrar la venta.';
  addMessage(s, { from: 'club', title: `✅ Vendido ${p?.name} al ${t.name}`, body: `Traspaso cerrado por ${fmtMoney(o.fee)}.` });
  return `${p?.name} vendido por ${fmtMoney(o.fee)}`;
}

export function rejectOffer(s: GameState, id: number): string {
  const o = find(s, id);
  if (!o) return 'La oferta ya no está.';
  const p = s.players.find((x) => x.id === o.playerId);
  remove(s, id);
  if (p && hasTrait(p, 'conflictivo')) {
    changeMorale(s, -2);
    addMessage(s, { from: 'club', title: `😤 ${p.name} no se calla`, body: 'Se entera de que has rechazado la oferta y lo cuenta en el vestuario.' });
  }
  if (o.wantsToLeave && p) {
    changeMorale(s, -3);
    addMessage(s, { from: 'club', title: `😒 ${p.name} está molesto`, body: 'Quería dar el salto a un club de más categoría y no le has dejado.' });
    return `Rechazada. ${p.name} está molesto.`;
  }
  return 'Oferta rechazada';
}

/** Pedir más dinero: si no pasa de su tope, aceptan; si no, pueden mejorar una vez o retirarse */
export function counterOffer(s: GameState, id: number, pct: number): string {
  const o = find(s, id);
  if (!o) return 'La oferta ya no está.';
  const t = teamById(s, o.teamId)!;
  const pide = roundMoney(o.fee * (1 + pct));
  if (pide <= o.maxFee) {
    o.fee = pide;
    return `${t.name} acepta. ` + acceptOffer(s, id);
  }
  if (o.rounds < 1 && chance(0.6)) {
    o.rounds++;
    o.fee = roundMoney(Math.min(o.maxFee, (o.fee + o.maxFee) / 2 + o.maxFee * 0.02));
    return `${t.name} no llega, pero mejora su oferta a ${fmtMoney(o.fee)}.`;
  }
  remove(s, id);
  return `${t.name} se retira de la negociación.`;
}

/** Consejo del director deportivo sobre una oferta */
export function directorAdvice(s: GameState, o: IncomingOffer): { action: 'aceptar' | 'pedir' | 'rechazar'; text: string } {
  const p = s.players.find((x) => x.id === o.playerId)!;
  const valor = playerValue(p);
  const clave = top3(s).has(p.id);
  const ratio = o.fee / valor;
  if (mySquad(s).length <= 20) return { action: 'rechazar', text: 'Nos quedaríamos cortos de plantilla.' };
  if (ratio >= (clave ? 1.4 : 1.1)) return { action: 'aceptar', text: `Es una gran oferta (${Math.round(ratio * 100)}% de su valor).` };
  if (ratio >= (clave ? 1.0 : 0.85) && o.rounds === 0) return { action: 'pedir', text: 'Pidamos un 15% más: creo que pueden subir.' };
  return { action: 'rechazar', text: clave ? 'Es de nuestros mejores: así no se vende.' : 'Se queda corta para lo que vale.' };
}

/** Si el director tiene las ventas delegadas en automático, responde él */
export function directorHandlesOffers(s: GameState, level: Level) {
  if (level !== 'auto' || !s.club.director) return;
  for (const o of [...s.incomingOffers]) {
    const consejo = directorAdvice(s, o);
    const p = s.players.find((x) => x.id === o.playerId);
    let res: string;
    if (consejo.action === 'aceptar') res = acceptOffer(s, o.id);
    else if (consejo.action === 'pedir') {
      res = counterOffer(s, o.id, 0.15);
      // si mejoran, decide otra vez con la nueva cifra
      const sigue = find(s, o.id);
      if (sigue) res += ' ' + (directorAdvice(s, sigue).action === 'aceptar' ? acceptOffer(s, o.id) : rejectOffer(s, o.id));
    } else res = rejectOffer(s, o.id);
    addMessage(s, { from: 'director', title: `Oferta por ${p?.name ?? 'un jugador'}: gestionada`, body: `${consejo.text}\n${res}` });
  }
}
