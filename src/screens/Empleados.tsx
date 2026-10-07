import type { ScreenProps } from '../App';
import { fmtMoney } from '../game/economy';
import { ROLES, ROLE_ORDER, fireStaff, hireStaff, staffWages, type Role } from '../game/staff';
import { Card, Stars } from '../ui';

export default function Empleados({ s, update, notify }: ScreenProps) {
  const staff = s.club.staff;
  const contratar = (role: Role, id: number, nombre: string) => {
    const err = update((g) => hireStaff(g, role, id));
    notify(err ?? `${nombre} contratado`);
  };

  return (
    <>
      <Card>
        <div className="kpis">
          <div><b>{ROLE_ORDER.filter((r) => staff[r]).length} / {ROLE_ORDER.length}</b><span>puestos cubiertos</span></div>
          <div><b>{fmtMoney(staffWages(s))}</b><span>sueldos/temporada</span></div>
        </div>
        {!staff.entrenador && <p className="hint warn-bg">⚠️ No tienes entrenador: el equipo rinde peor en cada partido.</p>}
        <p className="small muted">El director deportivo se gestiona en su propia pestaña.</p>
      </Card>

      {ROLE_ORDER.map((role) => {
        const info = ROLES[role];
        const actual = staff[role];
        const candidatos = s.staffMarket[role] ?? [];
        return (
          <Card key={role} title={`${info.icon} ${info.name}`}>
            <p className="small muted">{info.help}</p>
            {actual ? (
              <div className="dd current">
                <div>
                  <b>{actual.name}</b> <Stars n={actual.stars} />
                  <div className="small muted">{actual.trait} · {fmtMoney(actual.salary)}/temp.</div>
                </div>
                <button
                  className="btn small danger"
                  onClick={() => {
                    if (confirm(`¿Despedir a ${actual.name}? Pagarás una indemnización.`)) update((g) => fireStaff(g, role));
                  }}
                >
                  Despedir
                </button>
              </div>
            ) : (
              <p className="small"><b>Puesto vacante.</b></p>
            )}
            {candidatos.length > 0 && (
              <details open={!actual}>
                <summary>{actual ? 'Ver otros candidatos' : 'Candidatos'}</summary>
                {candidatos.map((c) => (
                  <div key={c.id} className="dd">
                    <div>
                      <b>{c.name}</b> <Stars n={c.stars} />
                      <div className="small muted">{c.trait} · {fmtMoney(c.salary)}/temp.</div>
                    </div>
                    <button className="btn small primary" onClick={() => contratar(role, c.id, c.name)}>
                      {actual ? 'Sustituir' : 'Contratar'}
                    </button>
                  </div>
                ))}
              </details>
            )}
          </Card>
        );
      })}
      <p className="small muted center">Cada pretemporada llegan candidatos nuevos.</p>
    </>
  );
}
