import { coachOf, ourTactics } from '../game/coach';
import { STYLES } from '../game/match';
import { FIT_ICON, PROFILES, TRAITS, adaptProgress, fitOf } from '../game/traits';
import type { GameState, Player } from '../game/types';
import { isKnown, reportCapacity, reportsLeft } from '../game/scouting';

/** Línea compacta: perfil, encaje con el sistema del entrenador y rasgos */
export function PlayerTags({ s, p }: { s: GameState; p: Player }) {
  if (!isKnown(s, p)) return <small className="tags">❓ Sin informe de los ojeadores</small>;
  const t = ourTactics(s);
  // quien ya se ha adaptado deja de contar como que no encaja
  const base = fitOf(p, t.formation, t.style);
  const f = base < 0 && p.teamId === s.club.teamId && adaptProgress(p, coachOf(s)?.id ?? 0) >= 1 ? 0 : base;
  return (
    <small className="tags">
      <span title={f > 0 ? 'Encaja en el sistema' : f < 0 ? 'No encaja en el sistema' : 'Neutro con el sistema'}>{FIT_ICON[f]}</span>
      {p.profile && <span>{PROFILES[p.profile].name}</span>}
      {p.traits?.map((tr) => (
        <span key={tr} title={TRAITS[tr].name}>{TRAITS[tr].icon}</span>
      ))}
    </small>
  );
}

/** Bloque para la ficha: perfil y encaje explicados, adaptación y rasgos */
export function ProfileDetail({ s, p, fichaje, onReport }: { s: GameState; p: Player; fichaje?: boolean; onReport?: () => void }) {
  if (!isKnown(s, p)) {
    const quedan = reportsLeft(s);
    return (
      <>
        <h4>Perfil y carácter</h4>
        <p className="small muted">❓ Sin informe: no sabes cómo encajaría en el sistema ni qué carácter tiene (ni si esconde más potencial).</p>
        {reportCapacity(s) > 0 ? (
          <button className="btn full" style={{ marginBottom: 12 }} onClick={onReport} disabled={quedan <= 0}>
            🔭 Pedir informe a los ojeadores ({quedan} {quedan === 1 ? 'queda' : 'quedan'} esta temporada)
          </button>
        ) : (
          <p className="small">Contrata un jefe de ojeadores (Dirección → Empleados) o construye la oficina de ojeadores para pedir informes.</p>
        )}
      </>
    );
  }
  const t = ourTactics(s);
  const coach = coachOf(s)?.id ?? 0;
  const prog = adaptProgress(p, coach);
  const base = fitOf(p, t.formation, t.style);
  const adaptado = base < 0 && !fichaje && prog >= 1;
  const f = adaptado ? 0 : base;
  return (
    <>
      <h4>Perfil de juego</h4>
      {p.profile && (
        <p className="small">
          <b>{PROFILES[p.profile].name}</b>
        </p>
      )}
      <p className="small">
        {FIT_ICON[f]} Con el {t.formation} {STYLES[t.style].label.toLowerCase()}{coachOf(s) ? ` de ${coachOf(s)!.name}` : ''}:{' '}
        <b className={f > 0 ? 'pos' : f < 0 ? 'neg' : ''}>
          {f > 0 ? 'encaja' : f < 0 ? 'no encaja' : adaptado ? 'ya se ha adaptado' : 'normal'}
        </b>
      </p>
      {(f < 0 || adaptado) && !fichaje && (
        <p className="small muted">
          🔄 {prog >= 1 ? 'Con los partidos se ha ido acostumbrando al sistema.' : 'Se está adaptando al sistema poco a poco.'}
        </p>
      )}
      {f < 0 && fichaje && <p className="small muted">🔄 Le costaría adaptarse al sistema.</p>}
      {(p.potHidden ?? 0) > 0 && (
        <p className="small">💎 <b>Promesa oculta:</b> los ojeadores creen que puede llegar mucho más lejos de lo que todos piensan.</p>
      )}
      {(p.traits?.length ?? 0) > 0 && (
        <>
          <h4>Carácter</h4>
          {p.traits!.map((tr) => (
            <p key={tr} className="small">
              {TRAITS[tr].icon} <b>{TRAITS[tr].name}</b> · <span className="muted">{TRAITS[tr].help}</span>
            </p>
          ))}
        </>
      )}
    </>
  );
}
