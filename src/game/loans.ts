import { DIV_LEVEL, fmtMoney, roundMoney } from './economy';
import { addMessage, marketOpen, myTeam, mySquad, squadOf, teamById, marketValue } from './market';
import { bestEleven } from './match';
import { randInt } from './rng';
import type { GameState, Player } from './types';

// Cesiones: una temporada, el club que recibe paga la ficha y el jugador vuelve en verano.

export const MAX_LOANS_IN = 3;
export const MAX_LOANS_OUT = 5;
/** Partidos que necesita un joven cedido para volver mejor */
export const LOAN_GROWTH_APPS = 12;

export const loanedOut = (s: GameState) => s.players.filter((p) => p.loan?.from === s.club.teamId && p.teamId !== s.club.teamId);
export const loanedIn = (s: GameState) => mySquad(s).filter((p) => p.loan && p.loan.from !== s.club.teamId);

/** Club al que iría cedido: uno de una categoría en la que tendría minutos */
export function loanTarget(s: GameState, p: Player) {
  const mia = myTeam(s).division;
  // la categoría cuyo nivel queda justo por debajo del suyo (para que juegue)
  let d = DIV_LEVEL.findIndex((lvl) => lvl <= p.ovr - 1);
  if (d < 0) d = DIV_LEVEL.length - 1;
  const candidatos = s.teams.filter((t) => t.division === d && t.id !== s.club.teamId);
  // misma elección mientras no cambie nada (no salta al repintar)
  const t = candidatos[(p.id * 7) % candidatos.length];
  return t ? { team: t, division: d, lower: d > mia } : undefined;
}

export function loanOut(s: GameState, id: number): string {
  if (!marketOpen(s)) return 'Las cesiones solo se cierran con el mercado abierto.';
  const p = mySquad(s).find((x) => x.id === id);
  if (!p) return 'El jugador ya no está en el club.';
  if (p.loan) return 'Ya está cedido.';
  if (mySquad(s).length <= 16) return 'No puedes quedarte con menos de 16 jugadores.';
  if (loanedOut(s).length >= MAX_LOANS_OUT) return `Ya tienes ${MAX_LOANS_OUT} jugadores cedidos.`;
  const dest = loanTarget(s, p);
  if (!dest) return 'Nadie lo quiere cedido.';
  p.loan = { from: s.club.teamId, until: s.season, apps: 0 };
  p.teamId = dest.team.id;
  addMessage(s, {
    from: 'club',
    title: `🔁 ${p.name}, cedido al ${dest.team.name}`,
    body: `Jugará esta temporada en ${dest.division + 1}ª división. Ellos pagan su ficha (${fmtMoney(p.salary)}) y vuelve en verano.`,
  });
  return `${p.name} cedido al ${dest.team.name}`;
}

/** Cuota por pedir cedido a un jugador */
export const loanFee = (s: GameState, p: Player) => roundMoney(marketValue(s, p) * 0.1);

/** ¿Lo cederían? Los clubes ceden a quien no es titular, y solo a clubes de su categoría o inferior */
export function loanAnswer(s: GameState, p: Player): { ok: boolean; reason?: string } {
  const club = teamById(s, p.teamId);
  if (!club || club.country) return { ok: false, reason: 'No está disponible.' };
  if (p.loan) return { ok: false, reason: 'Ya está cedido.' };
  if (club.division > myTeam(s).division) return { ok: false, reason: 'Los clubes de menos categoría no ceden: véndenlo.' };
  if (bestEleven(squadOf(s, club.id)).xi.some((x) => x.id === p.id)) return { ok: false, reason: `Es titular en el ${club.name}: no lo ceden.` };
  return { ok: true };
}

export function loanIn(s: GameState, id: number, cuotaPactada?: number): string {
  if (!marketOpen(s)) return 'El mercado está cerrado.';
  const p = s.players.find((x) => x.id === id);
  if (!p || p.teamId === null) return 'No está disponible.';
  if (loanedIn(s).length >= MAX_LOANS_IN) return `Como mucho ${MAX_LOANS_IN} cedidos a la vez.`;
  if (mySquad(s).length >= 26) return 'La plantilla está llena.';
  const r = loanAnswer(s, p);
  if (!r.ok) return r.reason!;
  const cuota = cuotaPactada ?? loanFee(s, p);
  if (s.club.transferBan === s.season) return 'Sanción por deuda: esta temporada no puedes pagar cuotas de cesión.';
  if (s.club.cash < cuota) return 'No hay dinero en caja para la cuota de cesión.';
  const club = teamById(s, p.teamId)!;
  s.club.cash -= cuota;
  s.club.ledger.traspasosOut += cuota;
  p.loan = { from: club.id, until: s.season, apps: 0 };
  p.teamId = s.club.teamId;
  addMessage(s, { from: 'club', title: `🔁 Llega cedido ${p.name}`, body: `Del ${club.name}, hasta final de temporada. Cuota: ${fmtMoney(cuota)}; pagamos su ficha (${fmtMoney(p.salary)}).` });
  return `${p.name} llega cedido`;
}

/** Fin de temporada: cada cedido vuelve a su club; los jóvenes que han jugado vuelven mejores */
export function returnLoans(s: GameState) {
  const vuelven: string[] = [];
  const seVan: string[] = [];
  for (const p of s.players) {
    if (!p.loan || p.loan.until > s.season) continue;
    const { from, apps } = p.loan;
    delete p.loan;
    if (from === s.club.teamId) {
      let extra = '';
      if (p.age <= 23 && apps >= LOAN_GROWTH_APPS && p.ovr < p.pot + (p.potHidden ?? 0)) {
        const sube = Math.min(p.pot + (p.potHidden ?? 0) - p.ovr, randInt(1, 3));
        p.ovr += sube;
        p.pot = Math.max(p.pot, p.ovr);
        extra = `, +${sube} de media`;
      }
      p.teamId = from;
      vuelven.push(`${p.name} (${apps} partidos${extra})`);
    } else {
      if (p.teamId === s.club.teamId) seVan.push(p.name);
      p.teamId = teamById(s, from) ? from : null;
    }
  }
  if (vuelven.length || seVan.length) {
    addMessage(s, {
      from: 'club',
      title: '🔁 Fin de las cesiones',
      body:
        (vuelven.length ? `Vuelven: ${vuelven.join(', ')}.` : '') +
        (seVan.length ? `${vuelven.length ? '\n' : ''}Regresan a sus clubes: ${seVan.join(', ')}.` : ''),
    });
  }
}
