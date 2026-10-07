import { DIV_PRICE, DIVISION_NAMES, MATCHDAYS, fmtMoney, ledgerIncome, roundMoney } from './economy';
import { operatingResult } from './bank';
import { changeSatisfaction } from './fans';
import { addMessage, mySquad, wageBill } from './market';
import type { GameState } from './types';

// Riesgo económico: cuanto más arriba, más cuesta competir; los beneficios tributan y la deuda se castiga.

/** Gastos de competición por temporada (desplazamientos, arbitrajes, seguridad, licencias) */
export const DIV_COMPETITION = [1_800_000, 450_000, 110_000, 30_000, 8_000];
/** Aforo mínimo que exige cada liga */
export const STADIUM_REQ = [12_000, 5_000, 2_000, 800, 0];
export const TAX_RATE = 0.25;
/** Subida de sueldos por la cláusula de ascenso (y bajada por la de descenso) */
export const PROMO_RAISE = 1.3;
export const RELEG_CUT = 0.85;

export const competitionPerMatchday = (division: number) => DIV_COMPETITION[division] / MATCHDAYS;

/** Multa de la liga por no llegar al aforo mínimo: como si se perdieran cinco llenos de esos asientos */
export function stadiumFine(s: GameState, division: number) {
  const falta = Math.max(0, STADIUM_REQ[division] - s.club.capacity);
  return roundMoney(falta * DIV_PRICE[division] * 5);
}

/** Cláusulas de ascenso o descenso en los contratos de la plantilla */
export function promotionClauses(s: GameState, divAntes: number, divDespues: number) {
  if (divAntes === divDespues) return;
  const sube = divDespues < divAntes;
  const factor = sube ? PROMO_RAISE : RELEG_CUT;
  const antes = wageBill(s);
  for (const p of mySquad(s)) if (!p.loan) p.salary = roundMoney(p.salary * factor);
  // el tope que el dueño marcó al director se ajusta igual para que no se quede bloqueado
  s.club.wageCap = roundMoney(s.club.wageCap * factor);
  const despues = wageBill(s);
  if (sube) {
    const prima = roundMoney(antes * 0.2);
    s.club.cash -= prima;
    s.club.ledger.salarios += prima;
    addMessage(s, {
      from: 'club',
      title: `💸 Cláusulas de ascenso: la masa salarial sube a ${fmtMoney(despues)}`,
      body:
        `Los contratos suben un ${Math.round((PROMO_RAISE - 1) * 100)}% al subir a ${DIVISION_NAMES[divDespues]} y se paga una prima de ascenso de ${fmtMoney(prima)}.\n` +
        `Los gastos de competición pasan a ${fmtMoney(DIV_COMPETITION[divDespues])}/temporada` +
        (STADIUM_REQ[divDespues] > s.club.capacity
          ? `. ⚠️ La liga exige ${STADIUM_REQ[divDespues].toLocaleString('es-ES')} espectadores de aforo: si no amplías el estadio habrá multa (${fmtMoney(stadiumFine(s, divDespues))}).`
          : '.') +
        `\nEl tope salarial del director se ajusta a ${fmtMoney(s.club.wageCap)}.`,
    });
  } else {
    addMessage(s, {
      from: 'club',
      title: `💸 Cláusulas de descenso: la masa salarial baja a ${fmtMoney(despues)}`,
      body: `Los contratos bajan un ${Math.round((1 - RELEG_CUT) * 100)}%, pero la televisión y los patrocinios de ${DIVISION_NAMES[divDespues]} son mucho menores.`,
    });
  }
}

/**
 * Cierre económico de la temporada: multa por estadio, impuesto sobre beneficios,
 * sanción por deuda y quejas si el club acumula dinero sin invertir.
 */
export function seasonFinances(s: GameState, divAntes: number, objetivoFallado: boolean) {
  const l = s.club.ledger;
  const multa = stadiumFine(s, divAntes);
  if (multa > 0) {
    s.club.cash -= multa;
    l.multas += multa;
    addMessage(s, {
      from: 'liga',
      title: `🚨 Multa de la liga: ${fmtMoney(multa)}`,
      body: `El estadio (${s.club.capacity.toLocaleString('es-ES')}) no llega al aforo mínimo de ${DIVISION_NAMES[divAntes]} (${STADIUM_REQ[divAntes].toLocaleString('es-ES')}). Amplíalo en Club → Instalaciones.`,
    });
  }
  const beneficio = operatingResult(l);
  if (beneficio > 0) {
    const impuesto = roundMoney(beneficio * TAX_RATE);
    s.club.cash -= impuesto;
    l.impuestos += impuesto;
    addMessage(s, {
      from: 'club',
      title: `🏦 Impuesto sobre beneficios: ${fmtMoney(impuesto)}`,
      body: `La temporada deja ${fmtMoney(beneficio)} de beneficio y tributa el ${Math.round(TAX_RATE * 100)}%. Lo que se invierte en plantilla e instalaciones no tributa.`,
    });
  }
  // control económico: acabar en negativo cierra el mercado de pago la temporada siguiente
  if (s.club.cash < 0) {
    s.club.transferBan = s.season + 1;
    changeSatisfaction(s, -3, 'Sanción por deuda');
    addMessage(s, {
      from: 'liga',
      title: '🚨 Control económico: sanción',
      body: `Cerramos la temporada con ${fmtMoney(s.club.cash)} en caja. La próxima temporada no podremos pagar traspasos ni cuotas de cesión: solo fichar jugadores libres.`,
    });
  }
  // la grada no entiende que el dinero se quede en el banco si el equipo no cumple
  const ingresos = ledgerIncome(l) - l.financiacion;
  if (objetivoFallado && s.club.cash > ingresos && s.club.cash > 0) {
    changeSatisfaction(s, -6, 'Dinero en caja sin invertir');
    addMessage(s, {
      from: 'prensa',
      title: '😞 «¡Gasta algo!», protesta la grada',
      body: `Hemos fallado el objetivo con ${fmtMoney(s.club.cash)} en caja, más de lo que ingresamos en toda la temporada. La afición pide que se invierta en el equipo.`,
    });
  }
}

/** ¿Estamos sancionados sin poder pagar traspasos? */
export const transferBanned = (s: GameState) => s.club.transferBan === s.season;
