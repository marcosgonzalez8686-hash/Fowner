import { addMessage } from './market';
import { ROLES, ROLE_ORDER, refusesRenewal } from './staff';
import type { GameState } from './types';

/** A falta de 8 jornadas, aviso de quién del cuerpo técnico acaba contrato */
export function warnContracts(s: GameState) {
  const lista: string[] = [];
  const d = s.club.director;
  if (d && (d.contract ?? 2) <= 1) lista.push(`${d.name} (director deportivo${refusesRenewal(s, d.stars) ? ', no quiere renovar' : ''})`);
  for (const role of ROLE_ORDER) {
    const c = s.club.staff[role];
    if (c && (c.contract ?? 2) <= 1) lista.push(`${c.name} (${ROLES[role].name.toLowerCase()}${refusesRenewal(s, c.stars) ? ', no quiere renovar' : ''})`);
  }
  if (!lista.length) return;
  addMessage(s, {
    from: 'club',
    title: `📝 Acaban contrato: ${lista.length}`,
    body: `Al final de la temporada se van si no renuevan: ${lista.join(', ')}.\nRenueva en Dirección → Director o Dirección → Empleados.`,
  });
}
