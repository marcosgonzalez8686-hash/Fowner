import { useState } from 'react';
import type { ScreenProps } from '../App';
import { executeProposal } from '../game/director';
import { MATCHDAYS } from '../game/economy';
import { marketOpen, myTeam, mySquad, myYouth, squadOf, teamById } from '../game/market';
import { bestEleven, computeStandings, form } from '../game/match';
import { ourPlan } from '../game/coach';
import { advanceWeek, endSeason, playMatchday, startSeason } from '../game/season';
import type { GameState, Message } from '../game/types';
import { Card } from '../ui';
import MatchSummary from '../components/MatchSummary';
import Crest from '../components/Crest';
import KitView from '../components/KitView';
import { rivalCrest } from '../game/identity';
import { resolveEvent } from '../game/events';
import { SlotOffers } from '../components/Sponsors';
import NegotiationsCard from '../components/Negotiations';
import { PRE_WEEKS, myTurn } from '../game/negotiation';
import Previa, { type MatchSetup } from '../components/Previa';
import LiveMatch from '../components/LiveMatch';
import { levelOf } from '../game/director';
import { ROUND_NAMES, myCupMatchDue, myTie, playCupRound } from '../game/cup';
import { TeamLink } from '../nav/context';
import { CONT_NAME, CONT_ROUNDS, FLAG, SUPER_NAME, myContDue, myContTie, mySuperDue, playContinentalRound, playSupercopa } from '../game/continental';
import { seasonTicketForecast } from '../game/tickets';
import { fmtMoney } from '../game/economy';
import FansCard, { ObjectivePicker } from '../components/FansCard';

function nextMatch(s: GameState) {
  const t = myTeam(s);
  if (s.phase !== 'temporada') return null;
  const f = s.fixtures[t.division][s.matchday].find((x) => x.home === t.id || x.away === t.id)!;
  const rivalId = f.home === t.id ? f.away : f.home;
  return { casa: f.home === t.id, rival: teamById(s, rivalId)! };
}

/** Número de decisiones pendientes (para el aviso de la pestaña) */
export function pendingCount(s: GameState) {
  const faltaCamiseta = !s.club.sponsors.camiseta && Boolean(s.sponsorOffers.camiseta?.length);
  const faltaObjetivo = s.phase === 'pretemporada' && !s.club.objective;
  return (s.pendingEvent ? 1 : 0) + s.messages.filter((m) => m.status === 'pendiente').length + (faltaCamiseta ? 1 : 0) + (faltaObjetivo ? 1 : 0) + myTurn(s).length;
}

export default function Inicio({ s, update, notify, go }: ScreenProps) {
  const [verResumen, setVerResumen] = useState(false);
  const faltaCamiseta = !s.club.sponsors.camiseta && Boolean(s.sponsorOffers.camiseta?.length);
  const ofertasPendientes = Object.entries(s.sponsorOffers).filter(([k, o]) => o?.length && k !== 'camiseta').length;
  const t = myTeam(s);
  const copaAhora = myCupMatchDue(s);
  // Supercopa (antes de la jornada 1) y Copa de Campeones (entre semana)
  const especial = (() => {
    if (mySuperDue(s)) {
      const sc = s.supercopa!;
      return { comp: 'super' as const, icon: '🏅', label: SUPER_NAME, rivalId: sc.a === t.id ? sc.b : sc.a, home: null as number | null };
    }
    if (!copaAhora && myContDue(s)) {
      const tie = myContTie(s)!;
      return { comp: 'europa' as const, icon: '🌍', label: `${CONT_NAME} · ${CONT_ROUNDS[s.continental!.current]}`, rivalId: tie.a === t.id ? tie.b : tie.a, home: tie.home };
    }
    return null;
  })();
  const prox = copaAhora || especial ? null : nextMatch(s);
  const tabla = computeStandings(s.teams.filter((x) => x.division === t.division).map((x) => x.id), s.fixtures[t.division]);
  const pos = tabla.findIndex((r) => r.teamId === t.id) + 1;
  const mia = ourPlan(s).strength;
  const propuestas = s.messages.filter((m) => m.status === 'pendiente');
  const miUltimo = s.lastResults.find((r) => r.home === t.id || r.away === t.id);
  const faltaObjetivo = s.phase === 'pretemporada' && !s.club.objective;
  const hayPendientes = Boolean(s.pendingEvent) || propuestas.length > 0 || faltaCamiseta || ofertasPendientes > 0 || faltaObjetivo || myTurn(s).length > 0;

  const nosotros = prox && (
    <div className="me">
      <Crest c={s.club.identity.crest} size={44} />
      <div>{t.name}</div>
    </div>
  );
  const ellos = prox && (
    <div>
      <Crest c={rivalCrest(prox.rival.id, prox.rival.short)} size={44} />
      <div><TeamLink id={prox.rival.id}>{prox.rival.name}</TeamLink></div>
    </div>
  );

  // los partidos se juegan de uno en uno y al acabar se enseña el resumen
  // previa → partido (en directo o solo resultado) → resumen
  const [fase, setFase] = useState<null | { tipo: 'previa'; setup: MatchSetup } | { tipo: 'directo' }>(null);
  const abrirPrevia = (setup: MatchSetup) => setFase({ tipo: 'previa', setup });
  const disputar = (comp: MatchSetup['comp'], enDirecto: boolean) => {
    update((g) =>
      comp === 'copa' ? playCupRound(g) : comp === 'super' ? playSupercopa(g) : comp === 'europa' ? playContinentalRound(g) : playMatchday(g),
    );
    if (enDirecto) setFase({ tipo: 'directo' });
    else {
      setFase(null);
      setVerResumen(true);
    }
  };
  const jugar = () =>
    prox &&
    abrirPrevia({
      comp: 'liga',
      label: `Jornada ${s.matchday + 1}`,
      homeId: prox.casa ? t.id : prox.rival.id,
      awayId: prox.casa ? prox.rival.id : t.id,
    });
  const tieCopa = copaAhora ? myTie(s) : undefined;
  const rivalCopa = tieCopa ? teamById(s, tieCopa.a === t.id ? tieCopa.b : tieCopa.a)! : undefined;
  const jugarCopa = () =>
    tieCopa &&
    rivalCopa &&
    abrirPrevia({
      comp: 'copa',
      label: `Copa · ${ROUND_NAMES[s.cup.current]}`,
      homeId: tieCopa.home === rivalCopa.id ? rivalCopa.id : t.id,
      awayId: tieCopa.home === rivalCopa.id ? t.id : rivalCopa.id,
      neutral: tieCopa.home === null,
    });

  const responder = (m: Message, aprobar: boolean) => {
    const err = update((g) => {
      const msg = g.messages.find((x) => x.id === m.id)!;
      msg.read = true;
      if (!aprobar) {
        msg.status = 'rechazada';
        return;
      }
      const e = executeProposal(g, msg.proposal!);
      msg.status = e ? 'caducada' : 'aprobada';
      return e;
    });
    notify(err ? `No se pudo: ${err}` : aprobar ? 'Aprobado' : 'Rechazado');
  };

  // lista de tareas de pretemporada
  const plantilla = mySquad(s);
  const tareas = [
    { ok: !faltaCamiseta, texto: 'Firmar patrocinador de camiseta', obligatoria: true, ir: undefined },
    { ok: !faltaObjetivo, texto: 'Fijar el objetivo de la temporada', obligatoria: true, ir: undefined },
    { ok: Boolean(s.club.staff.entrenador), texto: 'Contratar entrenador', obligatoria: false, ir: () => go('direccion', 'empleados') },
    {
      ok: plantilla.length >= 18 && plantilla.some((p) => p.pos === 'POR'),
      texto: `Plantilla completa (${plantilla.length} jugadores)`,
      obligatoria: false,
      ir: () => go('equipo', 'plantilla'),
    },
    ...(myYouth(s).length
      ? [{ ok: false, texto: `Decidir ${myYouth(s).length} juvenil(es) de la cantera`, obligatoria: false, ir: () => go('equipo', 'plantilla') }]
      : []),
    { ok: false, texto: `Campaña de abonos: ~${seasonTicketForecast(s).toLocaleString('es-ES')} abonos a ${fmtMoney(s.club.seasonTickets.price)}`, obligatoria: false, ir: () => go('finanzas', 'entradas') },
    { ok: Boolean(s.club.director), texto: 'Director deportivo (opcional)', obligatoria: false, ir: () => go('direccion', 'director') },
  ];

  return (
    <>
      <Card>
        {s.phase === 'pretemporada' && (
          <>
            <h2>Pretemporada {s.season}</h2>
            <p className="muted small">
              Semana {(s.preWeek ?? 0) + 1} de {PRE_WEEKS} · mercado abierto. Las negociaciones avanzan cada semana. Prepara el club antes de empezar:
            </p>
            <ul className="checklist">
              {tareas.map((x) => (
                <li key={x.texto} className={x.ok ? 'ok' : x.obligatoria ? 'must' : ''}>
                  <span className="check">{x.ok ? '✅' : x.obligatoria ? '❗' : '⬜'}</span>
                  {x.ir && !x.ok ? (
                    <button className="link" onClick={x.ir}>{x.texto} ›</button>
                  ) : (
                    <span>{x.texto}</span>
                  )}
                </li>
              ))}
            </ul>
            {(s.preWeek ?? 0) < PRE_WEEKS - 1 && (
              <button
                className="btn big full"
                onClick={() => {
                  const err = update((g) => advanceWeek(g));
                  notify(err ?? 'Pasa una semana de pretemporada');
                }}
              >
                ⏩ Avanzar una semana
              </button>
            )}
            <button
              className="btn primary big full"
              disabled={faltaCamiseta || faltaObjetivo}
              onClick={() => {
                const err = update((g) => startSeason(g));
                if (err) notify(err);
              }}
            >
              Empezar temporada
            </button>
          </>
        )}
        {especial && (() => {
          const rival = teamById(s, especial.rivalId)!;
          const local = especial.home === null ? t.id : especial.home;
          const yo = <div className="me"><Crest c={s.club.identity.crest} size={44} /><div>{t.name}</div></div>;
          const el = <div><Crest c={rivalCrest(rival.id, rival.short)} size={44} /><div><TeamLink id={rival.id}>{rival.name}</TeamLink></div></div>;
          return (
            <>
              <div className="match-head">
                <span className="cup-badge">{especial.icon} {especial.label}</span>
                <button className="link" onClick={() => go('equipo', 'copa')}>Cuadro ›</button>
              </div>
              <div className="versus">
                {local === t.id ? yo : el}
                <div className="vs">vs</div>
                {local === t.id ? el : yo}
              </div>
              <p className="muted center small">
                {rival.country ? `${FLAG[rival.country] ?? ''} ${rival.country}` : `${rival.division + 1}ª división`} ·{' '}
                {especial.home === null ? 'campo neutral' : especial.home === t.id ? 'en casa' : 'a domicilio'}
              </p>
              <div className="row">
                <button
                  className="btn primary big grow cup-btn"
                  disabled={Boolean(s.pendingEvent)}
                  onClick={() =>
                    abrirPrevia({
                      comp: especial.comp,
                      label: especial.label,
                      homeId: local,
                      awayId: local === t.id ? rival.id : t.id,
                      neutral: especial.home === null,
                    })
                  }
                >
                  {especial.icon} Jugar {especial.comp === 'super' ? 'la Supercopa' : 'partido europeo'}
                </button>
              </div>
              {s.pendingEvent && <p className="small muted center">Decide antes qué hacer con el asunto de esta semana ↓</p>}
            </>
          );
        })()}
        {tieCopa && rivalCopa && (
          <>
            <div className="match-head">
              <span className="cup-badge">🏆 Copa · {ROUND_NAMES[s.cup.current]}</span>
              <button className="link" onClick={() => go('equipo', 'copa')}>Cuadro ›</button>
            </div>
            <div className="versus">
              {tieCopa.home === rivalCopa.id ? <><div><Crest c={rivalCrest(rivalCopa.id, rivalCopa.short)} size={44} /><div><TeamLink id={rivalCopa.id}>{rivalCopa.name}</TeamLink></div></div><div className="vs">vs</div><div className="me"><Crest c={s.club.identity.crest} size={44} /><div>{t.name}</div></div></>
                : <><div className="me"><Crest c={s.club.identity.crest} size={44} /><div>{t.name}</div></div><div className="vs">vs</div><div><Crest c={rivalCrest(rivalCopa.id, rivalCopa.short)} size={44} /><div><TeamLink id={rivalCopa.id}>{rivalCopa.name}</TeamLink></div></div></>}
            </div>
            <p className="muted center small">
              Partido entre semana · {rivalCopa.name} juega en {rivalCopa.division + 1}ª división ·{' '}
              {tieCopa.home === t.id ? 'en casa' : tieCopa.home === null ? 'campo neutral' : 'a domicilio'}
              {rivalCopa.division < t.division && ' · ¡ocasión para una gesta!'}
            </p>
            <div className="row">
              <button className="btn primary big grow cup-btn" onClick={jugarCopa} disabled={Boolean(s.pendingEvent)}>
                🏆 Jugar partido de Copa
              </button>
            </div>
            {s.pendingEvent && <p className="small muted center">Decide antes qué hacer con el asunto de esta semana ↓</p>}
          </>
        )}
        {prox && (
          <>
            <div className="match-head">
              <span className="muted">Jornada {s.matchday + 1} de {MATCHDAYS}</span>
              <button className="link" onClick={() => go('equipo', 'liga')}>{pos}º en la liga ›</button>
            </div>
            <div className="versus">
              {prox.casa ? nosotros : ellos}
              <div className="vs">vs</div>
              {prox.casa ? ellos : nosotros}
            </div>
            <div className="kit-line">
              <KitView k={prox.casa ? s.club.identity.home : s.club.identity.away} size={26} />
              <span className="muted small">
                {prox.casa ? `En casa (${s.club.identity.stadium}), con la titular` : 'Fuera de casa, con la suplente'}
              </span>
            </div>
            <p className="muted center">
              Nuestro once: {mia.toFixed(1)} · Rival: {bestEleven(squadOf(s, prox.rival.id)).strength.toFixed(1)}
              {' · '}Racha: {form(t.id, s.fixtures[t.division]).join(' ') || '—'}
            </p>
            <div className="row">
              <button className="btn primary big grow" onClick={jugar} disabled={Boolean(s.pendingEvent)}>
                ⚽ Jugar partido
              </button>
            </div>
            {s.pendingEvent && <p className="small muted center">Decide antes qué hacer con el asunto de esta semana ↓</p>}
            {marketOpen(s) && (
              <button className="hint as-btn full-w mt" onClick={() => go('equipo', 'mercado')}>🔁 Mercado de invierno abierto ›</button>
            )}
          </>
        )}
        {s.phase === 'fin' && (
          <>
            <h2>Liga terminada</h2>
            <p className="muted">Acabamos {pos}º. Revisa la clasificación y cierra la temporada.</p>
            <button className="btn primary big" onClick={() => update((g) => endSeason(g))}>
              Cerrar temporada
            </button>
          </>
        )}
      </Card>

      {plantilla.length < 18 && s.phase !== 'fin' && (
        <button
          className="hint warn-bg as-btn full-w"
          onClick={() => (s.club.director && levelOf(s, 'fichajes') !== 'manual' ? go('direccion', 'presupuestos') : go('equipo', 'mercado'))}
        >
          ⚠️ Plantilla corta: solo {plantilla.length} jugadores.{' '}
          {s.club.director && levelOf(s, 'fichajes') !== 'manual'
            ? 'El director necesita más presupuesto o tope salarial para completarla ›'
            : 'Ficha en el Mercado o sube juveniles ›'}
        </button>
      )}

      {hayPendientes && <h3 className="section-title">📌 Pendiente de decidir</h3>}

      {s.pendingEvent && (
        <Card title={`${s.pendingEvent.icon} Esta semana`}>
          <h3 className="event-title">{s.pendingEvent.title}</h3>
          <p>{s.pendingEvent.body}</p>
          <div className="options">
            {s.pendingEvent.options.map((o, i) => (
              <button
                key={o.label}
                className={`btn option${i === 0 ? ' primary' : ''}`}
                onClick={() => {
                  const r = update((g) => resolveEvent(g, i));
                  if (r) notify(r);
                }}
              >
                <b>{o.label}</b>
                <small>{o.hint}</small>
              </button>
            ))}
          </div>
        </Card>
      )}

      {s.phase === 'pretemporada' && <ObjectivePicker s={s} update={update} notify={notify} />}

      {faltaCamiseta && (
        <Card title="👕 Patrocinador de camiseta">
          <p className="small muted">
            Tres empresas quieren poner su nombre en tu camiseta. Elige una para poder empezar la temporada.
          </p>
          <SlotOffers s={s} slot="camiseta" update={update} notify={notify} />
        </Card>
      )}

      {propuestas.length > 0 && (
        <Card title={`💼 Propuestas del director (${propuestas.length})`}>
          {propuestas.map((m) => (
            <div key={m.id} className="msg pending">
              <div className="msg-title">{m.title.replace(/^Propuesta: /, '')}</div>
              <p className="pre">{m.body}</p>
              <div className="row">
                <button className="btn primary grow" onClick={() => responder(m, true)}>Aprobar</button>
                <button className="btn grow" onClick={() => responder(m, false)}>Rechazar</button>
              </div>
            </div>
          ))}
        </Card>
      )}

      <NegotiationsCard s={s} update={update} notify={notify} onlyPending />

      {ofertasPendientes > 0 && (
        <button className="hint as-btn full-w" onClick={() => go('finanzas', 'patrocinadores')}>
          🤝 {ofertasPendientes} espacio(s) con ofertas de patrocinio sin firmar · Ver en Finanzas ›
        </button>
      )}

      {s.phase !== 'pretemporada' && <FansCard s={s} goPlantilla={() => go('equipo', 'plantilla')} goEmpleados={() => go('direccion', 'empleados')} />}

      {miUltimo && (
        <Card title={`Resultados jornada ${s.matchday}`} right={<button className="link" onClick={() => go('equipo', 'liga')}>Clasificación</button>}>
          {s.lastReport && s.lastReport.matchday === s.matchday && (
            <button className="btn full mb" onClick={() => setVerResumen(true)}>📋 Ver resumen de nuestro partido</button>
          )}
          {/* nuestro partido siempre a la vista; el resto de la jornada, plegado */}
          <ul className="results">
            {s.lastResults.filter((r) => r.home === t.id || r.away === t.id).map((r, i) => (
              <li key={i} className="me">
                <span className="h"><TeamLink id={r.home}>{teamById(s, r.home)!.name}</TeamLink></span>
                <span className="score">{r.hg} - {r.ag}</span>
                <span className="a"><TeamLink id={r.away}>{teamById(s, r.away)!.name}</TeamLink></span>
                {r.attendance !== undefined && (
                  <span className="att">👥 {r.attendance.toLocaleString('es-ES')} espectadores · {s.club.identity.stadium}</span>
                )}
              </li>
            ))}
          </ul>
          <details>
            <summary>Resto de la jornada</summary>
          <ul className="results">
            {s.lastResults.filter((r) => r.home !== t.id && r.away !== t.id).map((r, i) => {
              const mine = r.home === t.id || r.away === t.id;
              return (
                <li key={i} className={mine ? 'me' : ''}>
                  <span className="h"><TeamLink id={r.home}>{teamById(s, r.home)!.name}</TeamLink></span>
                  <span className="score">{r.hg} - {r.ag}</span>
                  <span className="a"><TeamLink id={r.away}>{teamById(s, r.away)!.name}</TeamLink></span>
                  {mine && r.attendance !== undefined && (
                    <span className="att">👥 {r.attendance.toLocaleString('es-ES')} espectadores · {s.club.identity.stadium}</span>
                  )}
                </li>
              );
            })}
          </ul>
          </details>
        </Card>
      )}

      {fase?.tipo === 'previa' && (
        <Previa
          s={s}
          setup={fase.setup}
          onPlay={() => disputar(fase.setup.comp, true)}
          onSkip={() => disputar(fase.setup.comp, false)}
          onClose={() => setFase(null)}
        />
      )}
      {fase?.tipo === 'directo' && s.lastReport && (
        <LiveMatch
          s={s}
          r={s.lastReport}
          onStats={() => {
            setFase(null);
            setVerResumen(true);
          }}
          onClose={() => setFase(null)}
        />
      )}
      {verResumen && s.lastReport && <MatchSummary s={s} r={s.lastReport} onClose={() => setVerResumen(false)} />}
    </>
  );
}
