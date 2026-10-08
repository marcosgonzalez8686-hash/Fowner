import type { ScreenProps } from '../App';
import { levelOf } from '../game/director';
import { DIV_LEVEL, fmtMoney, roundMoney } from '../game/economy';
import { FILIAL_AGE, FILIAL_GROWTH_APPS, FILIAL_MAX, createFilial, filialBlock, filialCreateCost, filialName, filialSeasonCost, sendToFilial } from '../game/filial';
import {
  marketValue, valueTrend, myFilial, myTeam, mySquad, myYouth, promoteYouth, releasePlayer, teamById, wageBill,
} from '../game/market';
import { FORMACION } from '../game/match';
import { coachOf, confidenceLabel, ourPlan, ourShape, tacticsLabel } from '../game/coach';
import type { GameState, Player, Pos } from '../game/types';
import { Card, Ovr, Stars } from '../ui';
import { moraleLabel } from '../game/morale';
import { FormStrip } from '../components/Rating';
import { PlayerTags } from '../components/Traits';
import { useNav } from '../nav/context';
import { loanedOut } from '../game/loans';
import { TREND_TEXT, trendOf } from '../game/aging';
import { condition } from '../game/fatigue';
import { potLabel } from '../game/scouting';
import { YELLOW_LIMIT } from '../game/discipline';
import { negFor } from '../game/negotiation';

/** Marcas de salida: transferible, cesión o venta en marcha, renovación */
function marcas(s: GameState, p: Player) {
  const n = negFor(s, p.id);
  const out: { text: string; cls: string }[] = [];
  if (n?.kind === 'venta') out.push(n.state === 'acordada' ? { text: '✍️ Vendido', cls: 'sale' } : { text: '🤝 Ofertas por él', cls: 'sale' });
  else if (p.listed) out.push({ text: '🏷️ Transferible', cls: 'sale' });
  if (n?.kind === 'cedo') out.push(n.state === 'acordada' ? { text: '✍️ Se va cedido', cls: 'loan' } : { text: '🔁 Ofrecido cedido', cls: 'loan' });
  if (n?.kind === 'renovacion') out.push({ text: '📝 Renovando', cls: 'renew' });
  return out;
}

const POS_NAME: Record<Pos, string> = { POR: 'Porteros', DEF: 'Defensas', MED: 'Centrocampistas', DEL: 'Delanteros' };

export default function Plantilla({ s, update, notify, go }: ScreenProps) {
  const { openPlayer } = useNav();
  const squad = mySquad(s);
  const youth = myYouth(s);
  const filial = myFilial(s);
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
          <div><b>{fmtMoney(wageBill(s))}</b><span>salarios/temp.</span></div>
          <div><b>{moraleLabel(s.club.morale).emoji} {moraleLabel(s.club.morale).text}</b><span>moral del vestuario</span></div>
          <div><b>{squad.filter((p) => (p.injury ?? 0) > 0).length}</b><span>lesionados</span></div>
          <div><b>{Math.round(xi.reduce((a, p) => a + condition(p), 0) / Math.max(1, xi.length))}%</b><span>condición del once</span></div>
          <div><b>{fmtMoney(squad.reduce((a, p) => a + marketValue(s, p), 0))}</b><span>valor de la plantilla</span></div>
        </div>
        {/* el entrenador decide el sistema: acceso directo a su ficha en Empleados */}
        <button className="coach-row as-btn" onClick={() => go('direccion', 'empleados')}>
          <span className="coach-ico" aria-hidden>🧢</span>
          <span className="coach-info">
            <b>{tacticsLabel(formation, style)}</b>
            {coachOf(s) ? (
              <small>
                {coachOf(s)!.name} <Stars n={coachOf(s)!.stars} />
                {' · '}
                {confidenceLabel(coachOf(s)!.confidence ?? 60).emoji} confianza {confidenceLabel(coachOf(s)!.confidence ?? 60).text.toLowerCase()}
                {(coachOf(s)!.contract ?? 2) <= 1 && <b className="warn"> · acaba contrato</b>}
              </small>
            ) : (
              <small className="neg">Sin entrenador: el capitán tira de un 4-4-2 y el equipo rinde peor</small>
            )}
          </span>
          <span className="coach-go">{coachOf(s) ? 'Entrenador ›' : 'Contratar ›'}</span>
        </button>
        {faltan.length > 0 && (
          <p className="hint warn-bg small">
            ⚠️ Para su {formation} faltan jugadores en: {faltan.map((pos) => POS_NAME[pos].toLowerCase()).join(', ')}. Juegan fuera de posición y rinden menos.
          </p>
        )}
        <p className="small muted">
          ⭐ titular · 🤕 lesionado · 🟥 sancionado · 🔋 condición física · ✅ encaja en el sistema · ➖ normal · ❌ no encaja · 🏷️ transferible · 🔁 ofrecido cedido. Toca un jugador para ver su perfil y su carácter.
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
              <span className="name">{p.name}<small>{p.age} años · {potLabel(p.ovr, p.pot)}</small></span>
              <Ovr v={p.ovr} base={nivel} />
              <button className="btn small primary" onClick={() => run(() => update((g) => promoteYouth(g, p.id).error), `${p.name} sube al primer equipo`)}>Subir</button>
              {s.club.filial && (
                <button className="btn small" disabled={Boolean(filialBlock(s, p))} onClick={() => run(() => update((g) => sendToFilial(g, p.id)), `${p.name} va al filial`)}>🅱️</button>
              )}
              <button className="btn small" onClick={() => run(() => update((g) => releasePlayer(g, p.id).error), `${p.name} se marcha`)}>✕</button>
            </div>
          ))}
        </Card>
      )}

      <Card title={s.club.filial ? `🅱️ ${filialName(s)} · ${filial.length}/${FILIAL_MAX}` : '🅱️ Filial'}>
        {!s.club.filial ? (
          <>
            <p className="small muted">
              Un equipo B donde los jóvenes (hasta {FILIAL_AGE} años) juegan cada semana y crecen más que en el banquillo. Siguen siendo tuyos y cobran su sueldo, pero no juegan con el primer equipo hasta que los subas.
            </p>
            <button className="btn full" onClick={() => run(() => update((g) => createFilial(g)), 'Filial creado')}>
              Crear filial ({fmtMoney(filialCreateCost(s))} de inscripción · después {fmtMoney(roundMoney(filialCreateCost(s) * 0.6))}/temp.)
            </button>
          </>
        ) : filial.length === 0 ? (
          <p className="small muted">Aún no hay nadie. Envía jóvenes desde su ficha o a los juveniles de la cantera con el botón 🅱️. Cuesta {fmtMoney(filialSeasonCost(s))}/temp.</p>
        ) : (
          <>
            {filial.sort((a, b) => b.ovr - a.ovr).map((p) => (
              <button key={p.id} className="player as-btn" onClick={() => openPlayer(p.id)}>
                <span className="pos">{p.pos}</span>
                <span className="name">
                  {p.name}
                  <small>
                    {p.age} años · {potLabel(p.ovr, p.pot)} · {p.filialApps ?? 0} partidos
                    {(p.filialApps ?? 0) >= FILIAL_GROWTH_APPS ? ' ✅' : ''}
                    {p.contract <= 1 && <b className="warn"> · acaba contrato</b>}
                    {(p.injury ?? 0) > 0 && <b className="neg"> · 🤕 {p.injury} j.</b>}
                  </small>
                </span>
                <Ovr v={p.ovr} base={nivel} />
              </button>
            ))}
            <p className="small muted">Con {FILIAL_GROWTH_APPS} partidos o más (✅), en verano crecen un extra. Al cumplir {FILIAL_AGE + 1} años suben al primer equipo. Coste: {fmtMoney(filialSeasonCost(s))}/temp. más sus sueldos.</p>
          </>
        )}
      </Card>

      {(Object.keys(FORMACION) as Pos[]).map((pos) => (
        <Card key={pos} title={`${POS_NAME[pos]} · ${forma[pos]} en el once`}>
          {squad
            .filter((p) => p.pos === pos)
            .sort((a, b) => b.ovr - a.ovr)
            .map((p) => (
              <button key={p.id} className="player as-btn" onClick={() => openPlayer(p.id)}>
                <span className="pos">{(p.injury ?? 0) > 0 ? '🤕' : (p.suspended ?? 0) > 0 ? '🟥' : titulares.has(p.id) ? '⭐' : ''}</span>
                <span className="name">
                  {p.name}
                  {marcas(s, p).map((m) => <span key={m.text} className={`mark ${m.cls}`}>{m.text}</span>)}
                  <small>
                    {(p.injury ?? 0) > 0 && <b className="neg">Lesionado {p.injury} j. · </b>}
                    {(p.suspended ?? 0) > 0 && <b className="neg">🟥 Sancionado {p.suspended} partido{p.suspended! > 1 ? 's' : ''} · </b>}
                    {(p.yellows ?? 0) >= YELLOW_LIMIT - 1 && <b className="warn">🟨 {p.yellows} amarillas: a una de la sanción · </b>}
                    {p.unhappy && <b className="warn">😤 quiere minutos · </b>}
                    {(p.promiseUntil ?? -1) >= s.matchday && s.phase === 'temporada' && <b>🤝 titular prometido · </b>}
                    {p.retiring && <b className="warn">👴 se retira · </b>}
                    {p.loan && <b>🔁 cedido por {teamById(s, p.loan.from)?.short} · </b>}
                    {p.age} años {TREND_TEXT[trendOf(p)].icon} · {fmtMoney(p.salary)} · {p.contract <= 1 ? <b className="warn">acaba contrato</b> : `${p.contract} temp.`}
                    {condition(p) < 80 && <b className={condition(p) < 55 ? 'neg' : 'warn'}> · 🔋 {condition(p)}%</b>}
                    {(() => {
                      const t = valueTrend(s, p);
                      return t !== null && Math.abs(t) >= 0.1 ? <span className={t > 0 ? 'pos' : 'neg'}> · {t > 0 ? '📈' : '📉'} {t > 0 ? '+' : ''}{Math.round(t * 100)}%</span> : null;
                    })()}
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
