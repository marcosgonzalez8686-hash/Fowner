import { DIV_TV, MATCHDAYS, fmtMoney, ledgerExpense, ledgerIncome, playerValue, roundMoney } from './economy';
import { changeSatisfaction } from './fans';
import { BUILDINGS, buildingLevel, type BuildingKind } from './land';
import { addMessage, mySquad, myTeam } from './market';
import { personName } from './names';
import { pick, rand } from './rng';
import { sponsorFixed } from './sponsor';
import { leagueAttendance, HOME_GAMES } from './tickets';
import type { GameState, Ledger } from './types';

// Financiación del club: préstamos del banco e inversores que compran una parte del club.

export interface Loan {
  id: number;
  amount: number; // capital prestado
  rate: number; // interés anual (0,07 = 7%)
  years: number;
  payment: number; // cuota por jornada de liga (capital + intereses)
  paymentsLeft: number;
  principalLeft: number;
}

export type InvestorKind = 'local' | 'fondo' | 'empresario';

export interface Investor {
  id: number;
  name: string;
  kind: InvestorKind;
  share: number; // parte del club (0,2 = 20%)
  amount: number; // lo que aportó
  since: number; // temporada en la que entró
}

export interface BankState {
  loans: Loan[];
  investors: Investor[];
  investorOffers: Investor[];
  lastDividends: number;
}

export const MAX_LOANS = 3;
export const MAX_INVESTOR_SHARE = 0.49;

export const INVESTOR_INFO: Record<InvestorKind, { label: string; icon: string; help: string }> = {
  local: { label: 'Socio de la comarca', icon: '🧑‍🌾', help: 'Paga algo menos, pero la afición lo ve con buenos ojos.' },
  fondo: { label: 'Fondo de inversión', icon: '🏦', help: 'Paga más que nadie, pero a la afición no le hace ninguna gracia.' },
  empresario: { label: 'Empresario', icon: '💼', help: 'Trae contactos: tus patrocinios valen un 5% más mientras siga dentro.' },
};

/**
 * Resultado de la actividad del club: sin el dinero recibido de préstamos e inversores,
 * sin la devolución del capital ni los pagos a inversores (los intereses sí cuentan como gasto).
 */
export function operatingResult(l: Ledger) {
  return ledgerIncome(l) - (l.financiacion ?? 0) - (ledgerExpense(l) - (l.cuotas ?? 0) - (l.inversores ?? 0));
}

/** Ingresos anuales aproximados del club (sin financiación) */
export function annualIncome(s: GameState) {
  const l = s.club.lastLedger;
  if (l) return Math.max(50_000, ledgerIncome(l) - (l.financiacion ?? 0));
  const t = myTeam(s);
  const taquilla = leagueAttendance(s).entradas * s.club.ticketPrice * HOME_GAMES;
  return Math.max(50_000, DIV_TV[t.division] + sponsorFixed(s) + taquilla);
}

export const totalDebt = (s: GameState) => s.club.bank.loans.reduce((a, x) => a + x.principalLeft, 0);
export const paymentPerMatchday = (s: GameState) => s.club.bank.loans.reduce((a, x) => a + x.payment, 0);

/** Calificación del banco según la deuda frente a los ingresos */
export function rating(s: GameState) {
  const ratio = totalDebt(s) / annualIncome(s);
  if (s.club.cash < 0 || ratio > 1) return { grade: 'C', premium: 0.045, maxRatio: 1.3 };
  if (ratio > 0.5) return { grade: 'B', premium: 0.02, maxRatio: 1.5 };
  return { grade: 'A', premium: 0, maxRatio: 1.5 };
}

/** Cuota por jornada de un préstamo francés */
function annuity(amount: number, rate: number, n: number) {
  const r = rate / MATCHDAYS;
  return r === 0 ? amount / n : (amount * r) / (1 - Math.pow(1 + r, -n));
}

export interface LoanOffer {
  amount: number;
  years: number;
  rate: number;
  payment: number;
  totalInterest: number;
}

/** Las tres ofertas del banco con la situación actual */
export function loanOffers(s: GameState): LoanOffer[] {
  const ingresos = annualIncome(s);
  const r = rating(s);
  const margen = Math.max(0, ingresos * r.maxRatio - totalDebt(s));
  return [
    { mult: 0.25, years: 1, base: 0.05 },
    { mult: 0.6, years: 3, base: 0.07 },
    { mult: 1.1, years: 5, base: 0.09 },
  ]
    .map(({ mult, years, base }) => {
      const amount = roundMoney(Math.min(ingresos * mult, margen));
      const rate = base + r.premium;
      const n = years * MATCHDAYS;
      const payment = Math.round(annuity(amount, rate, n));
      return { amount, years, rate, payment, totalInterest: Math.max(0, payment * n - amount) };
    })
    .filter((o) => o.amount >= 5_000);
}

export function takeLoan(s: GameState, years: number): string | undefined {
  if (s.club.bank.loans.length >= MAX_LOANS) return `Como mucho puedes tener ${MAX_LOANS} préstamos a la vez.`;
  const o = loanOffers(s).find((x) => x.years === years);
  if (!o) return 'El banco no te ofrece ese préstamo ahora mismo.';
  s.club.bank.loans.push({
    id: s.nextId++,
    amount: o.amount,
    rate: o.rate,
    years: o.years,
    payment: o.payment,
    paymentsLeft: o.years * MATCHDAYS,
    principalLeft: o.amount,
  });
  s.club.cash += o.amount;
  s.club.ledger.financiacion += o.amount;
  addMessage(s, {
    from: 'club',
    title: `🏦 Préstamo concedido: ${fmtMoney(o.amount)}`,
    body: `${o.years} año(s) al ${(o.rate * 100).toFixed(1).replace('.', ',')}%. Cuota de ${fmtMoney(o.payment)} por jornada de liga.`,
  });
}

/** Se paga una cuota de cada préstamo en cada jornada de liga */
export function payLoans(s: GameState) {
  const loans = s.club.bank.loans;
  for (const l of loans) {
    const interes = Math.round(l.principalLeft * (l.rate / MATCHDAYS));
    const cuota = Math.min(l.payment, l.principalLeft + interes);
    const capital = cuota - interes;
    l.principalLeft = Math.max(0, l.principalLeft - capital);
    l.paymentsLeft--;
    s.club.cash -= cuota;
    s.club.ledger.intereses += interes;
    s.club.ledger.cuotas += capital;
    if (l.paymentsLeft <= 0 || l.principalLeft <= 0) {
      addMessage(s, { from: 'club', title: '🏦 Préstamo devuelto', body: `Terminado de pagar el préstamo de ${fmtMoney(l.amount)}.` });
    }
  }
  s.club.bank.loans = loans.filter((l) => l.paymentsLeft > 0 && l.principalLeft > 0);
}

/** Amortizar antes de tiempo: capital pendiente más un 2% de comisión */
export const earlyRepayCost = (l: Loan) => roundMoney(l.principalLeft * 1.02);

export function repayLoan(s: GameState, id: number): string | undefined {
  const l = s.club.bank.loans.find((x) => x.id === id);
  if (!l) return 'Ese préstamo ya no existe.';
  const coste = earlyRepayCost(l);
  if (s.club.cash < coste) return 'No hay dinero suficiente para devolverlo.';
  s.club.cash -= coste;
  s.club.ledger.cuotas += l.principalLeft;
  s.club.ledger.intereses += coste - l.principalLeft;
  s.club.bank.loans = s.club.bank.loans.filter((x) => x.id !== id);
}

// ---------- inversores ----------

/** Lo que vale el club para un inversor */
export function clubValuation(s: GameState) {
  const plantilla = mySquad(s).reduce((a, p) => a + playerValue(p), 0);
  let instalaciones = 0;
  for (const k of Object.keys(BUILDINGS) as BuildingKind[]) {
    instalaciones += BUILDINGS[k].cost.slice(1, buildingLevel(s, k) + 1).reduce((a, b) => a + b, 0);
  }
  const estadio = s.club.capacity * 150;
  return roundMoney(Math.max(150_000, annualIncome(s) * 1.5 + plantilla * 0.3 + instalaciones * 0.5 + estadio * 0.5));
}

export const investorsShare = (s: GameState) => s.club.bank.investors.reduce((a, x) => a + x.share, 0);
export const empresarioBonus = (s: GameState) => (s.club.bank.investors.some((x) => x.kind === 'empresario') ? 1.05 : 1);

export function makeInvestorOffers(s: GameState): Investor[] {
  const valor = clubValuation(s);
  const libre = MAX_INVESTOR_SHARE - investorsShare(s);
  const perfiles: { kind: InvestorKind; share: number; mult: number }[] = [
    { kind: 'local', share: 0.1, mult: 0.9 },
    { kind: 'empresario', share: 0.2, mult: 1.0 },
    { kind: 'fondo', share: 0.3, mult: 1.15 },
  ];
  const nombres: Record<InvestorKind, () => string> = {
    local: () => personName(),
    empresario: () => personName(),
    fondo: () => pick(['Atalaya Capital', 'Norte Inversiones', 'Grupo Meridiano', 'Valdés Partners', 'Fondo Horizonte']),
  };
  return perfiles
    .filter((p) => p.share <= libre + 1e-9)
    .map((p) => ({
      id: s.nextId++,
      name: nombres[p.kind](),
      kind: p.kind,
      share: p.share,
      amount: roundMoney(valor * p.share * p.mult * rand(0.92, 1.08)),
      since: s.season,
    }));
}

export function acceptInvestor(s: GameState, id: number): string | undefined {
  const o = s.club.bank.investorOffers.find((x) => x.id === id);
  if (!o) return 'Esa oferta ya no está disponible.';
  if (investorsShare(s) + o.share > MAX_INVESTOR_SHARE + 1e-9) return 'No puedes ceder más del 49% del club.';
  s.club.bank.investors.push({ ...o, since: s.season });
  s.club.bank.investorOffers = [];
  s.club.cash += o.amount;
  s.club.ledger.financiacion += o.amount;
  if (o.kind === 'local') changeSatisfaction(s, 2, `Entra un socio de la comarca: ${o.name}`);
  if (o.kind === 'fondo') changeSatisfaction(s, -4, `Entra un fondo de inversión: ${o.name}`);
  addMessage(s, {
    from: 'club',
    title: `🤝 ${o.name} entra en el club`,
    body: `Aporta ${fmtMoney(o.amount)} a cambio del ${Math.round(o.share * 100)}% del club. Cobrará esa parte de los beneficios de cada temporada.`,
  });
}

/** Recomprar la parte de un inversor: lo que valga ahora con prima, y como mínimo un 30% más de lo que puso */
export function buybackPrice(s: GameState, inv: Investor) {
  return roundMoney(Math.max(inv.amount * 1.3, clubValuation(s) * inv.share * 1.1));
}

export function buyback(s: GameState, id: number): string | undefined {
  const inv = s.club.bank.investors.find((x) => x.id === id);
  if (!inv) return 'Ese inversor ya no está.';
  const precio = buybackPrice(s, inv);
  if (s.club.cash < precio) return 'No hay dinero suficiente.';
  s.club.cash -= precio;
  s.club.ledger.inversores += precio;
  s.club.bank.investors = s.club.bank.investors.filter((x) => x.id !== id);
  if (inv.kind === 'fondo') changeSatisfaction(s, 3, `Recompras la parte de ${inv.name}`);
  addMessage(s, { from: 'club', title: `Recompras la parte de ${inv.name}`, body: `Pagas ${fmtMoney(precio)} y recuperas el ${Math.round(inv.share * 100)}% del club.` });
}

/** Fin de temporada: los inversores cobran su parte del beneficio. Se llama antes de cerrar las cuentas. */
export function payDividends(s: GameState) {
  const share = investorsShare(s);
  s.club.bank.lastDividends = 0;
  if (!share) return;
  const beneficio = operatingResult(s.club.ledger);
  if (beneficio <= 0) {
    addMessage(s, { from: 'club', title: 'Sin reparto a inversores', body: 'La temporada no ha dado beneficios: los inversores no cobran nada.' });
    return;
  }
  const pago = roundMoney(beneficio * share);
  s.club.cash -= pago;
  s.club.ledger.inversores += pago;
  s.club.bank.lastDividends = pago;
  addMessage(s, {
    from: 'club',
    title: `💸 Reparto a inversores: ${fmtMoney(pago)}`,
    body: `Beneficio de la temporada: ${fmtMoney(beneficio)}. Los inversores tienen el ${Math.round(share * 100)}% del club.`,
  });
}

export const emptyBank = (): BankState => ({ loans: [], investors: [], investorOffers: [], lastDividends: 0 });

/** Cada pretemporada llegan nuevas ofertas de inversores */
export function refreshInvestorOffers(s: GameState) {
  s.club.bank.investorOffers = makeInvestorOffers(s);
}

