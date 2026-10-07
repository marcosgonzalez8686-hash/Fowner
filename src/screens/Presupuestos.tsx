import type { ScreenProps } from '../App';
import { setBudgets } from '../game/club';
import { fmtMoney } from '../game/economy';
import { wageBill } from '../game/market';
import { staffWages } from '../game/staff';
import { Card, Stepper } from '../ui';

function Uso({ usado, tope }: { usado: number; tope: number }) {
  const pct = tope > 0 ? (usado / tope) * 100 : 100;
  return (
    <>
      <div className={`meter${pct > 100 ? ' over' : ''}`}>
        <i style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      <p className="small muted center">
        Usado: {fmtMoney(usado)} de {fmtMoney(tope)} {pct > 100 ? '· ¡por encima del tope!' : `· libre ${fmtMoney(tope - usado)}`}
      </p>
    </>
  );
}

/** Límites de gasto que el dueño marca al director deportivo */
export default function Presupuestos({ s, update }: ScreenProps) {
  const c = s.club;
  return (
    <>
      <Card>
        <p className="small muted">
          Son los límites que respeta tu director deportivo en las tareas que le delegas. Tú puedes saltártelos cuando
          fichas o contratas directamente.
          {!c.director && ' Ahora mismo no tienes director deportivo.'}
        </p>
      </Card>

      <Card title="💸 Presupuesto de fichajes">
        <Stepper
          value={c.transferBudget}
          step={Math.max(5000, Math.round(c.cash / 20 / 5000) * 5000)}
          format={fmtMoney}
          onChange={(v) => update((g) => setBudgets(g, v, g.club.wageCap))}
        />
        <p className="small muted center">Lo que puede gastar en traspasos. Caja actual: {fmtMoney(c.cash)}.</p>
      </Card>

      <Card title="👕 Tope de salarios de la plantilla">
        <Stepper
          value={c.wageCap}
          step={Math.max(5000, Math.round(c.wageCap / 20 / 5000) * 5000)}
          format={fmtMoney}
          onChange={(v) => update((g) => setBudgets(g, g.club.transferBudget, v))}
        />
        <Uso usado={wageBill(s)} tope={c.wageCap} />
      </Card>

      <Card title="👔 Tope de salarios de empleados">
        <Stepper
          value={c.staffBudget}
          step={Math.max(2000, Math.round(c.staffBudget / 10 / 1000) * 1000)}
          format={fmtMoney}
          onChange={(v) => update((g) => setBudgets(g, g.club.transferBudget, g.club.wageCap, v))}
        />
        <Uso usado={staffWages(s)} tope={c.staffBudget} />
      </Card>
    </>
  );
}
