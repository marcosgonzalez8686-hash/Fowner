import type { ScreenProps } from '../App';
import { levelOf } from '../game/director';
import { DIV_LEVEL, fmtMoney } from '../game/economy';
import {
  myTeam, mySquad, myYouth, promoteYouth, releasePlayer, teamById, wageBill,
} from '../game/market';
import { FORMACION } from '../game/match';
import { coachOf, ourPlan, ourShape, tacticsLabel } from '../game/coach';
import type { Pos } from '../game/types';
import { Card, Ovr } from '../ui';
import { moraleLabel } from '../game/morale';
import { FormStrip } from '../components/Rating';
import { PlayerTags } from '../components/Traits';
import { useNav } from '../nav/context';
import { loanedOut } from '../game/loans';
import { fitOf } from '../game/traits';
import { TREND_TEXT, trendOf } from '../game/aging';

const POS_NAME: Record<Pos, string> = { POR: 'Porteros', DEF: 'Defensas', MED: 'Centrocampistas', DEL: 'Delanteros' };

export default function Plantilla({ s, update, notify }: ScreenProps) {
  const { openPlayer } = useNav();
  const squad = mySquad(s);
  const youth = myYouth(s);
  const nivel = DIV_LEVEL[myTeam(s).division];
  const { xi, strength, formation, style } = ourPlan(s, squad);
  const forma = ourShape(s);
  const faltan = (Object.keys(forma) as Pos[]).filter((pos) => squad.filter((p) => p.pos === pos && !p.youth).length < forma[pos]);
  const titulares = new Set(xi.map((p) => p.id));

  const run = (fn: () => string | undefined | void, ok: string) => {
    const err = fn();
    notify(err ?? ok);
  };

  return (
    <>
      <Card>
        <div className="kpis">
          <div><b>{squad.length}</b><span>jugadores</span></div>
          <div><b>{strength.toFixed(1)}</b><span>media del once</span></div>
          <div><b>{nivel}</b><span>media de la liga</span></div>
          <div><b>{fmtMoney(wageBill(s))}</b><span>salarios/temp.</span></div>
          <div><b>{moraleLabel(s.club.morale).emoji} {s.club.morale}</b><span>moral del vestuario</span></div>
          <div><b>{squad.filter((p) => (p.injury ?? 0) > 0).length}</b><span>lesionados</span></div>
        </div>
        <p className="small">
          🧢 <b>{tacticsLabel(formation, style)}</b>
          <span className="muted"> · {coachOf(s) ? `el sistema de ${coachOf(s)!.name}` : 'sin entrenador, el capitán tira de lo clásico'}</span>
        </p>
        <p className="small muted">
          En el once: {xi.filter((p) => fitOf(p, formation, style) > 0).length} encajan ✅ ·{' '}
          {xi.filter((p) => fitOf(p, formation, style) < 0).length} no encajan ❌ con su sistema
        </p>
        {faltan.length > 0 && (
          <p className="hint warn-bg small">
            ⚠️ Para su {formation} faltan jugadores en: {faltan.map((pos) => POS_NAME[pos].toLowerCase()).join(', ')}. Juegan fuera de posición y rinden menos.
          </p>
        )}
        <p className="small muted">
          ⭐ titular · 🤕 lesionado · ✅ encaja en el sistema (+2) · ➖ neutro · ❌ no encaja (−3, menos al adaptarse). Toca un jugador para ver su perfil y su carácter.
        </p>
      </Card>

      {youth.length > 0 && (
        <Card title="🌱 Juveniles de la cantera">
          <p className="muted small">
            {levelOf(s, 'cantera') === 'manual'
              ? 'Decide a quién subes. Los que no subas antes de la jornada 1 se marcharán.'
              : 'El director deportivo se encarga, pero puedes decidir tú.'}
          </p>
          {youth.map((p) => (
            <div key={p.id} className="player">
              <span className="pos">{p.pos}</span>
              <span className="name">{p.name}<small>{p.age} años · potencial {p.pot}</small></span>
              <Ovr v={p.ovr} base={nivel} />
              <button className="btn small primary" onClick={() => run(() => update((g) => promoteYouth(g, p.id).error), `${p.name} sube al primer equipo`)}>Subir</button>
              <button className="btn small" onClick={() => run(() => update((g) => releasePlayer(g, p.id).error), `${p.name} se marcha`)}>✕</button>
            </div>
          ))}
        </Card>
      )}

      {(Object.keys(FORMACION) as Pos[]).map((pos) => (
        <Card key={pos} title={`${POS_NAME[pos]} · ${forma[pos]} en el once`}>
          {squad
            .filter((p) => p.pos === pos)
            .sort((a, b) => b.ovr - a.ovr)
            .map((p) => (
              <button key={p.id} className="player as-btn" onClick={() => openPlayer(p.id)}>
                <span className="pos">{(p.injury ?? 0) > 0 ? '🤕' : titulares.has(p.id) ? '⭐' : ''}</span>
                <span className="name">
                  {p.name}
                  <small>
                    {(p.injury ?? 0) > 0 && <b className="neg">Lesionado {p.injury} j. · </b>}
                    {p.retiring && <b className="warn">👴 se retira · </b>}
                    {p.loan && <b>🔁 cedido por {teamById(s, p.loan.from)?.short} · </b>}
                    {p.age} años {TREND_TEXT[trendOf(p)].icon} · {fmtMoney(p.salary)} · {p.contract <= 1 ? <b className="warn">acaba contrato</b> : `${p.contract} temp.`}
                  </small>
                  <PlayerTags s={s} p={p} />
                  {p.form?.length ? (
                    <small className="form-line">
                      <FormStrip form={p.form} />
                      {p.season?.apps ? <span className="muted"> · {p.season.apps} PJ{p.season.goals ? ` · ${p.season.goals} ⚽` : ''}</span> : null}
                    </small>
                  ) : null}
                </span>
                <Ovr v={p.ovr} base={nivel} />
              </button>
            ))}
        </Card>
      ))}

      {loanedOut(s).length > 0 && (
        <Card title="🔁 Cedidos en otros clubes">
          {loanedOut(s).map((p) => (
            <button key={p.id} className="player as-btn" onClick={() => openPlayer(p.id)}>
              <span className="pos">{p.pos}</span>
              <span className="name">
                {p.name}
                <small>{teamById(s, p.teamId)?.name} ({(teamById(s, p.teamId)?.division ?? 0) + 1}ª) · {p.loan!.apps} partidos · {p.age} años</small>
              </span>
              <Ovr v={p.ovr} base={nivel} />
            </button>
          ))}
          <p className="small muted">Vuelven al acabar la temporada.</p>
        </Card>
      )}

    </>
  );
}
