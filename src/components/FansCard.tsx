import type { Update } from '../App';
import {
  OBJECTIVES, currentPosition, expectedObjective, objectiveTarget, objectiveText, satisfactionLabel, setObjective,
  type Objective,
} from '../game/fans';
import { myTeam, mySquad } from '../game/market';
import { moraleLabel } from '../game/morale';
import type { GameState } from '../game/types';
import { Card } from '../ui';

const ORDEN: Objective[] = ['ascenso', 'mitad', 'salvacion'];

/** Elección del objetivo de la temporada (pretemporada) */
export function ObjectivePicker({ s, update, notify }: { s: GameState; update: Update; notify: (m: string) => void }) {
  const division = myTeam(s).division;
  const esperado = expectedObjective(s);
  return (
    <Card title="🎯 Objetivo de la temporada">
      <p className="small muted">
        Lo anuncias ante los socios. Si lo cumples, la afición te respalda; si fallas, se enfada. Ser más ambicioso de lo
        que espera la grada ilusiona al principio, pero arriesga más.
      </p>
      <div className="options">
        {ORDEN.map((o) => {
          const info = OBJECTIVES[o];
          const elegido = s.club.objective === o;
          return (
            <button
              key={o}
              className={`btn option${elegido ? ' primary' : ''}`}
              onClick={() => {
                update((g) => setObjective(g, o));
                notify(`Objetivo: ${info.label}`);
              }}
            >
              {o === esperado && <span className="tag">👥 Lo que espera la afición</span>}
              <b>
                {info.icon} {info.label}
              </b>
              <small>
                {objectiveText(o, division)} · si lo cumples +{info.reward}, si no {info.penalty} de satisfacción
              </small>
            </button>
          );
        })}
      </div>
    </Card>
  );
}

function Meter({ value, label, emoji, text }: { value: number; label: string; emoji: string; text: string }) {
  return (
    <div className="mood">
      <div className="mood-head">
        <span>{label}</span>
        <b>
          {emoji} {text} · {Math.round(value)}
        </b>
      </div>
      <div className={`meter${value < 30 ? ' over' : ''}`}>
        <i style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

/** Estado de la afición, el vestuario y el objetivo */
export default function FansCard({ s, goPlantilla }: { s: GameState; goPlantilla: () => void }) {
  const sat = satisfactionLabel(s.club.satisfaction);
  const mor = moraleLabel(s.club.morale);
  const lesionados = mySquad(s).filter((p) => (p.injury ?? 0) > 0);
  const obj = s.club.objective;
  const division = myTeam(s).division;
  const pos = s.phase === 'temporada' && s.matchday > 0 ? currentPosition(s) : null;
  const objetivoPos = obj ? objectiveTarget(obj, division) : null;

  return (
    <Card title="📣 Afición y vestuario">
      <Meter value={s.club.satisfaction} label="Afición" emoji={sat.emoji} text={sat.text} />
      <Meter value={s.club.morale} label="Moral del vestuario" emoji={mor.emoji} text={mor.text} />
      {obj && (
        <p className="small">
          {OBJECTIVES[obj].icon} <b>Objetivo:</b> {objectiveText(obj, division)}
          {pos !== null && objetivoPos !== null && (
            <span className={pos <= objetivoPos ? 'pos' : 'neg'}> · vamos {pos}º</span>
          )}
        </p>
      )}
      {lesionados.length > 0 && (
        <button className="link small" onClick={goPlantilla}>
          🤕 {lesionados.length} lesionado(s): {lesionados.map((p) => `${p.name} (${p.injury} j.)`).join(', ')} ›
        </button>
      )}
      {s.club.satLog.length > 0 && (
        <details>
          <summary>Por qué cambia la afición</summary>
          <ul className="satlog">
            {s.club.satLog.slice(0, 8).map((x, i) => (
              <li key={i}>
                <span className={x.delta >= 0 ? 'pos' : 'neg'}>{x.delta > 0 ? '+' : ''}{x.delta.toString().replace('.', ',')}</span> {x.text}
              </li>
            ))}
          </ul>
        </details>
      )}
    </Card>
  );
}
