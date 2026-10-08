import { DIV_LEVEL, DIVISION_NAMES, fairSalary, fmtMoney, playerValue, roundMoney } from './economy';
import { addMessage, marketOpen, myTeam, squadOf, teamById } from './market';
import { FORMACION } from './match';
import { breakNegotiationsFor } from './negotiation';
import { chance, pick, rand, randInt } from './rng';
import type { GameState, Player, Pos, Team } from './types';

// Mercado entre los demás clubes: con el mercado abierto se fichan entre ellos (y a agentes libres).
// Pueden adelantarse y llevarse a un jugador por el que estamos negociando.

const POSICIONES: Pos[] = ['POR', 'DEF', 'MED', 'DEL'];
const MIN_PLANTILLA = 18;
const MAX_PLANTILLA = 25;

interface Movimiento { p: Player; from: Team | null; to: Team; fee: number; nuestro: boolean }

/** Una ronda de fichajes de la IA (una semana de pretemporada o una jornada del mercado de invierno) */
export function aiTransfers(s: GameState) {
  if (!marketOpen(s)) return;
  const mio = s.club.teamId;
  // jugadores que ya tienen firmado venir con nosotros: esos no se tocan
  const firmados = new Set(s.negotiations.filter((n) => n.state === 'acordada').map((n) => n.playerId));
  const movimientos: Movimiento[] = [];
  const ops = s.phase === 'pretemporada' ? randInt(6, 10) : randInt(3, 6);
  for (let i = 0; i < ops; i++) {
    const comprador = pick(s.teams.filter((t) => t.id !== mio));
    const plantilla = squadOf(s, comprador.id);
    if (plantilla.length >= MAX_PLANTILLA + 1) continue;
    const nivel = DIV_LEVEL[comprador.division];
    const pos = pick(POSICIONES);
    const titulares = plantilla.filter((p) => p.pos === pos).sort((a, b) => b.ovr - a.ovr).slice(0, FORMACION[pos]);
    const liston = titulares.length >= FORMACION[pos] ? titulares[titulares.length - 1].ovr : nivel - 6;
    const candidatos = s.players.filter((p) => {
      if (p.pos !== pos || p.teamId === comprador.id || p.teamId === mio || p.loan || p.youth || p.retiring || firmados.has(p.id)) return false;
      // quien ya ha cambiado de club esta temporada no se vuelve a mover
      if (p.signedSeason === s.season) return false;
      if (p.ovr < liston + 2 || p.ovr > nivel + 8 || p.age > 32) return false;
      if (p.teamId === null) return true;
      const vendedor = teamById(s, p.teamId);
      // se ficha a clubes de la misma categoría o de abajo, y el vendedor no se queda corto
      return Boolean(vendedor && !vendedor.country && vendedor.division >= comprador.division && squadOf(s, vendedor.id).length > MIN_PLANTILLA);
    });
    if (!candidatos.length) continue;
    const p = pick(candidatos.sort((a, b) => b.ovr - a.ovr).slice(0, 5));
    const from = p.teamId === null ? null : teamById(s, p.teamId)!;
    const fee = from ? roundMoney(playerValue(p) * rand(0.9, 1.35)) : 0;
    const estabamos = breakNegotiationsFor(s, p.id, `El ${comprador.name} se ha adelantado y ${p.name} ficha por ellos${fee ? ` (${fmtMoney(fee)})` : ''}.`);
    p.teamId = comprador.id;
    p.contract = randInt(2, 4);
    p.salary = roundMoney(Math.max(p.salary, fairSalary(p)));
    p.listed = false;
    p.signedSeason = s.season;
    movimientos.push({ p, from, to: comprador, fee, nuestro: estabamos });
    // si se pasa de jugadores, deja libre al peor de esa posición
    const ahora = squadOf(s, comprador.id);
    if (ahora.length > MAX_PLANTILLA) {
      const peor = ahora.filter((x) => x.pos === pos && x.id !== p.id).sort((a, b) => a.ovr - b.ovr)[0];
      if (peor) peor.teamId = null;
    }
  }
  // los jugadores por los que pujamos llaman la atención: a veces otro club se adelanta
  for (const n of s.negotiations.filter((x) => (x.state === 'esperando' || x.state === 'tu_turno') && x.kind === 'compra' && x.clubId !== null)) {
    if (!chance(0.1)) continue;
    const p = s.players.find((x) => x.id === n.playerId);
    const vendedor = teamById(s, n.clubId);
    if (!p || !vendedor || vendedor.country || p.teamId !== vendedor.id) continue;
    const rivales = s.teams.filter((t) => t.id !== mio && t.id !== vendedor.id && t.division <= vendedor.division && squadOf(s, t.id).length < MAX_PLANTILLA);
    if (!rivales.length) continue;
    const to = pick(rivales);
    const fee = roundMoney(Math.max(n.fee, playerValue(p)) * rand(1.05, 1.3));
    breakNegotiationsFor(s, p.id, `El ${to.name} se ha adelantado y ${p.name} ficha por ellos (${fmtMoney(fee)}).`);
    p.teamId = to.id;
    p.contract = randInt(2, 4);
    p.salary = roundMoney(Math.max(p.salary, fairSalary(p)));
    p.signedSeason = s.season;
    movimientos.push({ p, from: vendedor, to, fee, nuestro: true });
  }
  noticias(s, movimientos);
}

/** Resumen en el buzón: los de nuestra categoría, los grandes y los que nos afectan */
function noticias(s: GameState, movs: Movimiento[]) {
  const div = myTeam(s).division;
  const relevantes = movs.filter((m) => m.nuestro || m.to.division === div || m.from?.division === div || m.to.division === 0);
  if (!relevantes.length) return;
  const linea = (m: Movimiento) =>
    `• ${m.p.name} (${m.p.pos}, ${m.p.ovr}): ${m.from ? `${m.from.name} → ` : 'libre → '}${m.to.name}${m.fee ? ` · ${fmtMoney(m.fee)}` : ''}`;
  addMessage(s, {
    from: 'prensa',
    title: relevantes.some((m) => m.nuestro)
      ? '📰 Mercado: se nos adelantan por un fichaje'
      : `📰 Mercado: ${relevantes.length} fichaje${relevantes.length > 1 ? 's' : ''} (${DIVISION_NAMES[div]} y Primera)`,
    body: relevantes.map(linea).join('\n'),
  });
}
