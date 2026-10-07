import type { ScreenProps } from '../App';
import { CashChart, ConceptBars, SeasonResults, type BarItem } from '../components/Charts';
import { DIVISION_NAMES, MATCHDAYS, fmtMoney, ledgerExpense, ledgerIncome } from '../game/economy';
import { projectSeason } from '../game/finance';
import { maintenancePerSeason } from '../game/land';
import { wageBill } from '../game/market';
import { creditLimit, expectedAttendance } from '../game/season';
import type { Ledger } from '../game/types';
import { Card, Money } from '../ui';

const LINEAS: { k: keyof Ledger; label: string; gasto?: boolean }[] = [
  { k: 'taquilla', label: 'Taquilla' },
  { k: 'comercial', label: 'Tienda y bar' },
  { k: 'tv', label: 'Televisión' },
  { k: 'patrocinio', label: 'Patrocinio' },
  { k: 'traspasosIn', label: 'Ventas' },
  { k: 'copa', label: 'Premios de Copa' },
  { k: 'salarios', label: 'Salarios', gasto: true },
  { k: 'director', label: 'Director dep.', gasto: true },
  { k: 'mantenimiento', label: 'Mantenimiento', gasto: true },
  { k: 'personal', label: 'Empleados y otros', gasto: true },
  { k: 'traspasosOut', label: 'Fichajes', gasto: true },
  { k: 'obras', label: 'Obras y terrenos', gasto: true },
];

function Cuentas({ l }: { l: Ledger }) {
  return (
    <table className="table money">
      <tbody>
        {LINEAS.map((x) => (
          <tr key={x.k}>
            <td className="left">{x.label}</td>
            <td><Money v={x.gasto ? -l[x.k] : l[x.k]} /></td>
          </tr>
        ))}
        <tr className="total">
          <td className="left">Resultado</td>
          <td><Money v={ledgerIncome(l) - ledgerExpense(l)} sign /></td>
        </tr>
      </tbody>
    </table>
  );
}

export default function Resumen({ s }: ScreenProps) {
  const c = s.club;
  const prev = projectSeason(s);
  const p = prev.pending;
  const ingresosPrev = p.taquilla + p.comercial + p.tv + p.patrocinio;
  const gastosPrev = p.salarios + p.director + p.mantenimiento + p.personal;
  const restantes = s.phase === 'fin' ? 0 : MATCHDAYS - s.matchday;
  const ocupacion = expectedAttendance(s);
  const barras: BarItem[] = LINEAS.map((x) => ({ label: x.label, value: c.ledger[x.k], kind: x.gasto ? 'out' : 'in' }));
  const historico = c.seasonLog.map((h) => ({
    label: `T${h.season}`,
    sub: `${h.division + 1}ª div.`,
    value: ledgerIncome(h.ledger) - ledgerExpense(h.ledger),
  }));

  return (
    <>
      <Card>
        <div className="kpis">
          <div><b><Money v={c.cash} /></b><span>caja</span></div>
          <div><b><Money v={prev.cashEnd} /></b><span>caja prevista al final</span></div>
          <div><b>{fmtMoney(wageBill(s))}</b><span>salarios/temporada</span></div>
          <div><b>{fmtMoney(creditLimit(s))}</b><span>deuda máxima</span></div>
        </div>
      </Card>

      <Card title="📈 Caja de la temporada">
        <CashChart real={c.cashLog} forecast={prev.cashPath} total={MATCHDAYS} />
        {prev.cashEnd < 0 && (
          <p className="hint warn-bg">
            ⚠️ Con lo que gastas ahora acabarías la temporada en números rojos
            {prev.cashEnd < -creditLimit(s) ? ' y por encima de la deuda máxima: el club quebraría.' : '.'}
          </p>
        )}
      </Card>

      <Card title="🔮 Previsión hasta final de temporada">
        <p className="small muted">
          {restantes} jornadas por jugar, {prev.homeMatches} en casa. Supone que no fichas ni construyes nada más y que vienen
          unos {ocupacion.toLocaleString('es-ES')} espectadores por partido.
        </p>
        <table className="table money">
          <tbody>
            <tr><td className="left">Taquilla</td><td><Money v={p.taquilla} /></td></tr>
            <tr><td className="left">Tienda y bar</td><td><Money v={p.comercial} /></td></tr>
            <tr><td className="left">Televisión y patrocinio</td><td><Money v={p.tv + p.patrocinio} /></td></tr>
            <tr><td className="left">Salarios</td><td><Money v={-p.salarios} /></td></tr>
            <tr><td className="left">Director deportivo</td><td><Money v={-p.director} /></td></tr>
            <tr><td className="left">Mantenimiento</td><td><Money v={-p.mantenimiento} /></td></tr>
            <tr><td className="left">Empleados</td><td><Money v={-p.personal} /></td></tr>
            <tr className="total"><td className="left">Balance previsto</td><td><Money v={ingresosPrev - gastosPrev} sign /></td></tr>
            <tr className="total"><td className="left">Caja al final</td><td><Money v={prev.cashEnd} /></td></tr>
          </tbody>
        </table>
        <p className="small muted">Mantenimiento de instalaciones: {fmtMoney(maintenancePerSeason(s))}/temporada.</p>
      </Card>

      <Card title="📊 Ingresos y gastos de esta temporada">
        <ConceptBars items={barras} />
        <details>
          <summary>Ver tabla</summary>
          <Cuentas l={c.ledger} />
        </details>
      </Card>

      {historico.length > 0 && (
        <Card title="🗂️ Temporadas anteriores">
          <SeasonResults rows={historico.slice(-8)} />
          <details>
            <summary>Ver tabla</summary>
            <table className="table money">
              <thead>
                <tr><th className="left">Temporada</th><th>Ingresos</th><th>Gastos</th><th>Caja final</th></tr>
              </thead>
              <tbody>
                {c.seasonLog.map((h) => (
                  <tr key={h.season}>
                    <td className="left">T{h.season} · {DIVISION_NAMES[h.division]}</td>
                    <td>{fmtMoney(ledgerIncome(h.ledger))}</td>
                    <td>{fmtMoney(ledgerExpense(h.ledger))}</td>
                    <td><Money v={h.cashEnd} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </Card>
      )}

    </>
  );
}
