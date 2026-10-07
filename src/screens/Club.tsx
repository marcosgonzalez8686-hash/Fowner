import type { ScreenProps } from '../App';
import { expandStadium, setBudgets, setTicketPrice, stadiumCost, upgradeFacility } from '../game/club';
import { COSTE_INSTALACION, DIV_PRICE, NIVEL_MAX, fmtMoney, ledgerExpense, ledgerIncome } from '../game/economy';
import { myTeam, wageBill } from '../game/market';
import { creditLimit, expectedAttendance, sponsorFor } from '../game/season';
import type { Ledger } from '../game/types';
import { Card, Money, Stepper } from '../ui';

const LINEAS: { k: keyof Ledger; label: string; gasto?: boolean }[] = [
  { k: 'taquilla', label: 'Taquilla' },
  { k: 'tv', label: 'Televisión' },
  { k: 'patrocinio', label: 'Patrocinio' },
  { k: 'traspasosIn', label: 'Ventas de jugadores' },
  { k: 'salarios', label: 'Salarios', gasto: true },
  { k: 'director', label: 'Director deportivo', gasto: true },
  { k: 'traspasosOut', label: 'Fichajes', gasto: true },
  { k: 'obras', label: 'Obras e instalaciones', gasto: true },
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

const FACILITY_INFO = {
  training: { label: 'Ciudad deportiva', help: 'Los jugadores jóvenes mejoran más rápido.' },
  academy: { label: 'Cantera', help: 'Salen juveniles mejores y con más potencial.' },
} as const;

export default function ClubScreen({ s, update, notify, onMenu, onDelete }: ScreenProps & { onMenu: () => void; onDelete: () => void }) {
  const t = myTeam(s);
  const c = s.club;
  const ampliaciones = [250, 1000, 5000];
  const ocupacion = expectedAttendance(s);

  return (
    <>
      <Card title="Finanzas">
        <div className="kpis">
          <div><b><Money v={c.cash} /></b><span>caja</span></div>
          <div><b>{fmtMoney(creditLimit(s))}</b><span>deuda máxima</span></div>
          <div><b>{fmtMoney(sponsorFor(s))}</b><span>patrocinio/temp.</span></div>
          <div><b>{t.fans.toLocaleString('es-ES')}</b><span>aficionados</span></div>
        </div>
        <h4>Esta temporada</h4>
        <Cuentas l={c.ledger} />
        {c.lastLedger && (
          <details>
            <summary>Temporada anterior</summary>
            <Cuentas l={c.lastLedger} />
          </details>
        )}
      </Card>

      <Card title="🎟️ Entradas">
        <Stepper value={c.ticketPrice} step={1} min={1} format={(v) => `${v} €`} onChange={(v) => update((g) => setTicketPrice(g, v))} />
        <p className="small muted center">
          Precio de referencia en esta categoría: {DIV_PRICE[t.division]} €. Asistencia esperada: {ocupacion.toLocaleString('es-ES')} de{' '}
          {c.capacity.toLocaleString('es-ES')} ({fmtMoney(ocupacion * c.ticketPrice)} por partido).
        </p>
      </Card>

      <Card title="🏟️ Estadio">
        <p>Aforo: <b>{c.capacity.toLocaleString('es-ES')}</b></p>
        {c.works ? (
          <p className="hint">🚧 Obras en marcha: +{c.works.amount} asientos, faltan {c.works.matchdaysLeft} jornadas.</p>
        ) : (
          <div className="row wrap">
            {ampliaciones.map((n) => (
              <button
                key={n}
                className="btn"
                disabled={c.cash < stadiumCost(n)}
                onClick={() => notify(update((g) => expandStadium(g, n)) ?? 'Obras iniciadas')}
              >
                +{n.toLocaleString('es-ES')} asientos · {fmtMoney(stadiumCost(n))}
              </button>
            ))}
          </div>
        )}
      </Card>

      <Card title="🏗️ Instalaciones">
        {(['training', 'academy'] as const).map((k) => (
          <div key={k} className="facility">
            <div>
              <b>{FACILITY_INFO[k].label}</b> · nivel {c[k]}/{NIVEL_MAX}
              <div className="small muted">{FACILITY_INFO[k].help}</div>
            </div>
            {c[k] < NIVEL_MAX && (
              <button
                className="btn small"
                disabled={c.cash < COSTE_INSTALACION[c[k] + 1]}
                onClick={() => notify(update((g) => upgradeFacility(g, k)) ?? 'Mejora completada')}
              >
                Mejorar · {fmtMoney(COSTE_INSTALACION[c[k] + 1])}
              </button>
            )}
          </div>
        ))}
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
