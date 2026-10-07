import type { ScreenProps } from '../App';
import {
  INVESTOR_INFO, MAX_INVESTOR_SHARE, MAX_LOANS, acceptInvestor, annualIncome, buyback, buybackPrice, clubValuation,
  earlyRepayCost, investorsShare, loanOffers, paymentPerMatchday, rating, repayLoan, takeLoan, totalDebt,
} from '../game/bank';
import { MATCHDAYS, fmtMoney } from '../game/economy';
import { Card } from '../ui';

const pct = (x: number) => `${(x * 100).toFixed(1).replace('.', ',')}%`;

export default function Banca({ s, update, notify }: ScreenProps) {
  const b = s.club.bank;
  const r = rating(s);
  const ofertas = loanOffers(s);
  const cedido = investorsShare(s);
  const run = (fn: () => string | undefined | void, ok: string) => notify(fn() ?? ok);

  return (
    <>
      <Card title="🏦 Préstamos">
        <div className="kpis">
          <div><b>{fmtMoney(totalDebt(s))}</b><span>deuda pendiente</span></div>
          <div><b>{fmtMoney(paymentPerMatchday(s))}</b><span>cuota por jornada</span></div>
          <div><b className={`grade grade-${r.grade}`}>{r.grade}</b><span>calificación del banco</span></div>
          <div><b>{fmtMoney(annualIncome(s))}</b><span>ingresos anuales que ve el banco</span></div>
        </div>
        <p className="small muted">
          Las cuotas se pagan en cada jornada de liga e incluyen capital e intereses. Cuanto más debes respecto a lo que
          ingresas, peor calificación: más interés y menos dinero disponible.
        </p>

        {b.loans.map((l) => (
          <div key={l.id} className="loan">
            <div className="offer-head">
              <b>{fmtMoney(l.amount)} a {l.years} año(s)</b>
              <span className="tag">{pct(l.rate)}</span>
            </div>
            <div className="small muted">
              Quedan {fmtMoney(l.principalLeft)} · {l.paymentsLeft} cuotas de {fmtMoney(l.payment)}
            </div>
            <button
              className="btn small full"
              disabled={s.club.cash < earlyRepayCost(l)}
              onClick={() => {
                if (confirm(`¿Devolver ya el préstamo por ${fmtMoney(earlyRepayCost(l))} (incluye 2% de comisión)?`)) {
                  run(() => update((g) => repayLoan(g, l.id)), 'Préstamo devuelto');
                }
              }}
            >
              Devolver ahora · {fmtMoney(earlyRepayCost(l))}
            </button>
          </div>
        ))}

        <h4>Ofertas del banco</h4>
        {b.loans.length >= MAX_LOANS ? (
          <p className="small muted">Ya tienes {MAX_LOANS} préstamos: devuelve alguno para pedir otro.</p>
        ) : ofertas.length === 0 ? (
          <p className="small muted">Con tu nivel de deuda, el banco no te presta más ahora mismo.</p>
        ) : (
          ofertas.map((o) => (
            <div key={o.years} className="offer">
              <div className="offer-head">
                <b>{fmtMoney(o.amount)}</b>
                <span className="tag">{o.years} año{o.years > 1 ? 's' : ''} · {pct(o.rate)}</span>
              </div>
              <ul className="offer-terms">
                <li>Cuota: {fmtMoney(o.payment)} por jornada ({o.years * MATCHDAYS} cuotas)</li>
                <li>Pagarás {fmtMoney(o.totalInterest)} de intereses en total</li>
              </ul>
              <button
                className="btn primary full"
                onClick={() => {
                  if (confirm(`¿Pedir ${fmtMoney(o.amount)} a ${o.years} año(s)?`)) run(() => update((g) => takeLoan(g, o.years)), 'Préstamo concedido');
                }}
              >
                Pedir préstamo
              </button>
            </div>
          ))
        )}
      </Card>

      <Card title="🤝 Inversores">
        <div className="kpis">
          <div><b>{Math.round((1 - cedido) * 100)}%</b><span>del club es tuyo</span></div>
          <div><b>{fmtMoney(clubValuation(s))}</b><span>valor estimado del club</span></div>
        </div>
        <p className="small muted">
          Un inversor aporta dinero a cambio de una parte del club y cobra esa parte de los beneficios de cada temporada
          (si hay pérdidas, no cobra). Como mucho puedes ceder el {Math.round(MAX_INVESTOR_SHARE * 100)}%: el control es siempre tuyo.
          {b.lastDividends > 0 && ` La temporada pasada se les pagaron ${fmtMoney(b.lastDividends)}.`}
        </p>

        {b.investors.map((inv) => (
          <div key={inv.id} className="loan">
            <div className="offer-head">
              <b>{INVESTOR_INFO[inv.kind].icon} {inv.name}</b>
              <span className="tag">{Math.round(inv.share * 100)}%</span>
            </div>
            <div className="small muted">
              {INVESTOR_INFO[inv.kind].label} · aportó {fmtMoney(inv.amount)} en la temporada {inv.since}
            </div>
            <button
              className="btn small full"
              disabled={s.club.cash < buybackPrice(s, inv)}
              onClick={() => {
                if (confirm(`¿Recomprar su ${Math.round(inv.share * 100)}% por ${fmtMoney(buybackPrice(s, inv))}?`)) {
                  run(() => update((g) => buyback(g, inv.id)), 'Participación recomprada');
                }
              }}
            >
              Recomprar su parte · {fmtMoney(buybackPrice(s, inv))}
            </button>
          </div>
        ))}

        <h4>Interesados en entrar</h4>
        {b.investorOffers.length === 0 ? (
          <p className="small muted">No hay ofertas ahora mismo. Llegan nuevas en cada pretemporada.</p>
        ) : (
          b.investorOffers.map((o) => (
            <div key={o.id} className="offer">
              <div className="offer-head">
                <b>{INVESTOR_INFO[o.kind].icon} {o.name}</b>
                <span className="tag">{Math.round(o.share * 100)}% del club</span>
              </div>
              <div className="small muted">{INVESTOR_INFO[o.kind].label} · {INVESTOR_INFO[o.kind].help}</div>
              <ul className="offer-terms">
                <li>Aporta <b>{fmtMoney(o.amount)}</b> ahora</li>
                <li>Se llevará el {Math.round(o.share * 100)}% de los beneficios de cada temporada</li>
              </ul>
              <button
                className="btn primary full"
                disabled={cedido + o.share > MAX_INVESTOR_SHARE + 1e-9}
                onClick={() => {
                  if (confirm(`¿Ceder el ${Math.round(o.share * 100)}% del club a ${o.name} por ${fmtMoney(o.amount)}?`)) {
                    run(() => update((g) => acceptInvestor(g, o.id)), `${o.name} entra en el club`);
                  }
                }}
              >
                Aceptar
              </button>
            </div>
          ))
        )}
      </Card>
    </>
  );
}
