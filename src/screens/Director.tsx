import type { ScreenProps } from '../App';
import { setAllDelegation, setDelegation } from '../game/club';
import { LEVEL_LABEL, STYLE_LABEL, TASK_HELP, TASK_LABEL, fireDirector, hireDirector } from '../game/director';
import { fmtMoney } from '../game/economy';
import type { Level, Task } from '../game/types';
import { Card, Segmented, Stars } from '../ui';

const TASKS: Task[] = ['fichajes', 'ventas', 'renovaciones', 'cantera', 'empleados'];
const LEVELS: Level[] = ['manual', 'propone', 'auto'];
const LEVEL_SHORT: Record<Level, string> = { manual: '🧑‍💼 Yo', propone: '✅ Propone', auto: '🤖 Auto' };

export default function DirectorScreen({ s, update, notify }: ScreenProps) {
  const d = s.club.director;

  return (
    <>
      <Card title="Director deportivo">
        {d ? (
          <>
            <div className="dd">
              <div>
                <b>{d.name}</b> <Stars n={d.stars} />
                <div className="small muted">{STYLE_LABEL[d.style]} · {fmtMoney(d.salary)}/temp.</div>
              </div>
              <button
                className="btn small danger"
                onClick={() => {
                  if (confirm(`¿Despedir a ${d.name}? Pagarás una indemnización.`)) update((g) => fireDirector(g));
                }}
              >
                Despedir
              </button>
            </div>
            <p className="small muted">
              Cuantas más estrellas, mejor valora a los jugadores y mejor negocia precios y salarios.
            </p>
          </>
        ) : (
          <p className="muted">
            No tienes director deportivo: todas las decisiones deportivas son tuyas. Contrata uno abajo para poder delegar.
          </p>
        )}
      </Card>

      <Card title="¿Qué le delegas?">
        {TASKS.map((t) => (
          <div key={t} className="task">
            <div className="task-head">
              <b>{TASK_LABEL[t]}</b>
              <span className="small muted">{d ? LEVEL_LABEL[s.club.delegation[t]] : LEVEL_LABEL.manual}</span>
            </div>
            <div className="small muted">{TASK_HELP[t]}</div>
            <Segmented
              value={d ? s.club.delegation[t] : 'manual'}
              disabled={!d}
              options={LEVELS.map((l) => ({ value: l, label: LEVEL_SHORT[l] }))}
              onChange={(l) => update((g) => setDelegation(g, t, l))}
            />
          </div>
        ))}
        <div className="row">
          <button className="btn small grow" disabled={!d} onClick={() => update((g) => setAllDelegation(g, 'manual'))}>Todo yo</button>
          <button className="btn small grow" disabled={!d} onClick={() => update((g) => setAllDelegation(g, 'propone'))}>Todo propone</button>
          <button className="btn small grow" disabled={!d} onClick={() => update((g) => setAllDelegation(g, 'auto'))}>Todo auto</button>
        </div>
        <p className="small muted">Sus límites de gasto se fijan en Dirección → Presupuesto.</p>
      </Card>

      <Card title={d ? 'Otros candidatos' : 'Candidatos disponibles'}>
        {s.directorsMarket.map((c) => (
          <div key={c.id} className="dd">
            <div>
              <b>{c.name}</b> <Stars n={c.stars} />
              <div className="small muted">{STYLE_LABEL[c.style]} · {fmtMoney(c.salary)}/temp.</div>
            </div>
            <button
              className="btn small primary"
              onClick={() => {
                update((g) => hireDirector(g, c.id));
                notify(`${c.name} contratado`);
              }}
            >
              Contratar
            </button>
          </div>
        ))}
      </Card>
    </>
  );
}
