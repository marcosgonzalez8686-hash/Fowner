import type { ScreenProps } from '../App';
import { fmtMoney } from '../game/economy';
import { ROLES, ROLE_ORDER, coachSeverance, fireStaff, hireStaff, staffWages, type Role, type Staff } from '../game/staff';
import { coachRenewal, confidenceLabel, ourPlan, renewCoach, tacticsLabel } from '../game/coach';
import { elevenFor } from '../game/match';
import { fitBonus, fitOf } from '../game/traits';
import { mySquad } from '../game/market';
import { Card, Stars } from '../ui';

export default function Empleados({ s, update, notify }: ScreenProps) {
  const staff = s.club.staff;
  const mediaActual = ourPlan(s).strength;
  /** Sistema de un entrenador y cómo quedaría nuestro once con él */
  const sistema = (c: Staff) => {
    if (!c.formation || !c.style) return null;
    // con un entrenador nuevo nadie está adaptado; con el actual se respeta lo ya adaptado
    const f = c.formation;
    const st = c.style;
    const plan = elevenFor(mySquad(s), f, (p) => p.ovr + fitBonus(p, f, st, c.id));
    const media = plan.strength;
    const bien = plan.xi.filter((p) => fitOf(p, f, st) > 0).length;
    const mal = plan.xi.filter((p) => fitOf(p, f, st) < 0).length;
    const dif = media - mediaActual;
    return (
      <div className="small">
        🧢 {tacticsLabel(c.formation, c.style)} · once con su sistema: <b>{media.toFixed(1)}</b>
        {staff.entrenador && staff.entrenador.id !== c.id && Math.abs(dif) >= 0.1 && (
          <span className={dif > 0 ? 'pos' : 'neg'}> ({dif > 0 ? '+' : ''}{dif.toFixed(1)})</span>
        )}
        <div className="muted">En su once: {bien} encajan ✅ · {mal} no encajan ❌</div>
      </div>
    );
  };
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
          {!staff.entrenador && <p className="hint warn-bg">⚠️ No tienes entrenador: el equipo rinde peor en cada partido y juega un 4-4-2 sin más.</p>}
          <p className="small muted">El equipo juega siempre con el sistema y el estilo de su entrenador: elige uno que encaje con tu plantilla.</p>
          <p className="small muted">
            {s.club.director && s.club.delegation.empleados !== 'manual'
              ? `Tu director deportivo se encarga de contratar (${s.club.delegation.empleados === 'auto' ? 'automático' : 'te lo propone'}) con un tope de ${fmtMoney(s.club.staffBudget)}/temp. Puedes contratar tú igualmente.`
              : 'Contratas tú. Si quieres, delega esta tarea en el director deportivo (Dirección → Director).'}
          </p>
        </Card>

        {ROLE_ORDER.map((role) => {
          const info = ROLES[role];
          const actual = staff[role];
          const candidatos = s.staffMarket[role] ?? [];
          return (
            <Card key={role} title={`${info.icon} ${info.name}`}>
              <p className="small muted">{info.help}</p>
              {actual ? (
                <>
                <div className="dd current">
                  <div>
                    <b>{actual.name}</b> <Stars n={actual.stars} />
                    <div className="small muted">
                      {actual.trait} · {fmtMoney(actual.salary)}/temp.
                      {role === 'entrenador' && actual.contract !== undefined && (
                        <> · {actual.contract <= 1 ? <b className="warn">acaba contrato</b> : `${actual.contract} temp. de contrato`}</>
                      )}
                    </div>
                    {role === 'entrenador' && sistema(actual)}
                    {role === 'entrenador' && actual.confidence !== undefined && (
                      <div className="small">
                        {confidenceLabel(actual.confidence).emoji} Confianza: <b>{confidenceLabel(actual.confidence).text}</b> ({Math.round(actual.confidence)})
                      </div>
                    )}
                  </div>
                  <button
                    className="btn small danger"
                    onClick={() => {
                      const coste = fmtMoney(coachSeverance(s, actual));
                      const texto = role === 'entrenador'
                        ? `¿Destituir a ${actual.name}? Hay que pagarle lo que le queda de contrato: ${coste}.`
                        : `¿Despedir a ${actual.name}? Indemnización: ${coste}.`;
                      if (confirm(texto)) {
                        update((g) => fireStaff(g, role));
                        notify(`${actual.name} ${role === 'entrenador' ? 'destituido' : 'despedido'} (${coste})`);
                      }
                    }}
                  >
                    {role === 'entrenador' ? 'Destituir' : 'Despedir'}
                  </button>
                </div>
                {role === 'entrenador' && (actual.contract ?? 2) <= 1 && (
                  <button
                    className="btn full"
                    onClick={() => notify(update((g) => renewCoach(g)) ?? 'Renovado')}
                  >
                    ✍️ Renovar 2 temporadas por {fmtMoney(coachRenewal(actual).salary)}/temp.
                  </button>
                )}
              </>
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
                      <div className="small muted">
                        {c.trait} · {fmtMoney(c.salary)}/temp.{c.contract ? ` · ${c.contract} temp.` : ''}
                      </div>
                      {role === 'entrenador' && sistema(c)}
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
