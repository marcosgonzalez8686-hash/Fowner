import type { ScreenProps } from '../App';
import { CashChart, ConceptBars, SeasonResults, type BarItem } from '../components/Charts';
import { setBudgets, setTicketPrice } from '../game/club';
import { DIV_PRICE, DIVISION_NAMES, MATCHDAYS, fmtMoney, ledgerExpense, ledgerIncome } from '../game/economy';
import { projectSeason } from '../game/finance';
import { maintenancePerSeason } from '../game/land';
import { myTeam, wageBill } from '../game/market';
import { creditLimit, expectedAttendance, sponsorFor } from '../game/season';
import type { Ledger } from '../game/types';
import { Card, Money, Stepper } from '../ui';

const LINEAS: { k: keyof Ledger; label: string; gasto?: boolean }[] = [
  { k: 'taquilla', label: 'Taquilla' },
  { k: 'comercial', label: 'Tienda y bar' },
  { k: 'tv', label: 'Televisión' },
  { k: 'patrocinio', label: 'Patrocinio' },
  { k: 'traspasosIn', label: 'Ventas' },
  { k: 'salarios', label: 'Salarios', gasto: true },
  { k: 'director', label: 'Director dep.', gasto: true },
  { k: 'mantenimiento', label: 'Mantenimiento', gasto: true },
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

export default function Finanzas({ s, update, onMenu, onDelete }: ScreenProps & { onMenu: () => void; onDelete: () => void }) {
  const t = myTeam(s);
  const c = s.club;
  const prev = projectSeason(s);
  const p = prev.pending;
  const ingresosPrev = p.taquilla + p.comercial + p.tv + p.patrocinio;
  const gastosPrev = p.salarios + p.director + p.mantenimiento;
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

      <Card title="🎟️ Entradas">
        <Stepper value={c.ticketPrice} step={1} min={1} format={(v) => `${v} €`} onChange={(v) => update((g) => setTicketPrice(g, v))} />
        <p className="small muted center">
          Precio de referencia en esta categoría: {DIV_PRICE[t.division]} €. Asistencia esperada: {ocupacion.toLocaleString('es-ES')} de{' '}
          {c.capacity.toLocaleString('es-ES')} ({fmtMoney(ocupacion * c.ticketPrice)} por partido).
        </p>
        <p className="small muted center">
          Patrocinio: {fmtMoney(sponsorFor(s))}/temp. · Afición: {t.fans.toLocaleString('es-ES')}
        </p>
      </Card>

      <Card title="💼 Límites para el director deportivo">
        <p className="small muted">Lo que puede gastar si tiene delegados los fichajes o las renovaciones.</p>
        <h4>Presupuesto de fichajes</h4>
        <Stepper
          value={c.transferBudget}
          step={Math.max(5000, Math.round(c.cash / 20 / 5000) * 5000)}
          format={fmtMoney}
          onChange={(v) => update((g) => setBudgets(g, v, g.club.wageCap))}
        />
        <h4>Tope de masa salarial</h4>
        <Stepper
          value={c.wageCap}
          step={Math.max(5000, Math.round(c.wageCap / 20 / 5000) * 5000)}
          format={fmtMoney}
          onChange={(v) => update((g) => setBudgets(g, g.club.transferBudget, v))}
        />
        <p className="small muted center">Salarios actuales: {fmtMoney(wageBill(s))}/temp.</p>
      </Card>

      <button className="btn full" onClick={onMenu}>
        Volver al menú de partidas
      </button>
      <button
        className="btn danger full"
        onClick={() => {
          if (confirm('¿Seguro? Se borrará esta partida y no se puede deshacer.')) onDelete();
        }}
      >
        Vender el club (borrar esta partida)
      </button>
    </>
  );
}
