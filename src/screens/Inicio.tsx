import { useState } from 'react';
import type { ScreenProps } from '../App';
import { executeProposal } from '../game/director';
import { MATCHDAYS } from '../game/economy';
import { marketOpen, myTeam, mySquad, myYouth, squadOf, teamById } from '../game/market';
import { bestEleven, computeStandings, form } from '../game/match';
import { endSeason, playMatchday, startSeason } from '../game/season';
import type { GameState, Message } from '../game/types';
import { Card } from '../ui';
import MatchSummary from '../components/MatchSummary';
import Crest from '../components/Crest';
import KitView from '../components/KitView';
import { rivalCrest } from '../game/identity';
import { resolveEvent } from '../game/events';
import { SlotOffers } from '../components/Sponsors';
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
  return (s.pendingEvent ? 1 : 0) + s.messages.filter((m) => m.status === 'pendiente').length + (faltaCamiseta ? 1 : 0) + (faltaObjetivo ? 1 : 0);
}

export default function Inicio({ s, update, notify, go }: ScreenProps) {
  const [verResumen, setVerResumen] = useState(false);
  const faltaCamiseta = !s.club.sponsors.camiseta && Boolean(s.sponsorOffers.camiseta?.length);
  const ofertasPendientes = Object.entries(s.sponsorOffers).filter(([k, o]) => o?.length && k !== 'camiseta').length;
  const t = myTeam(s);
  const prox = nextMatch(s);
  const tabla = computeStandings(s.teams.filter((x) => x.division === t.division).map((x) => x.id), s.fixtures[t.division]);
  const pos = tabla.findIndex((r) => r.teamId === t.id) + 1;
  const mia = bestEleven(squadOf(s, t.id)).strength;
  const propuestas = s.messages.filter((m) => m.status === 'pendiente');
  const miUltimo = s.lastResults.find((r) => r.home === t.id || r.away === t.id);
  const faltaObjetivo = s.phase === 'pretemporada' && !s.club.objective;
  const hayPendientes = Boolean(s.pendingEvent) || propuestas.length > 0 || faltaCamiseta || ofertasPendientes > 0 || faltaObjetivo;

  const nosotros = prox && (
    <div className="me">
      <Crest c={s.club.identity.crest} size={44} />
      <div>{t.name}</div>
    </div>
  );
  const ellos = prox && (
    <div>
      <Crest c={rivalCrest(prox.rival.id, prox.rival.short)} size={44} />
      <div>{prox.rival.name}</div>
    </div>
  );

  // los partidos se juegan de uno en uno y al acabar se enseña el resumen
  const jugar = () => {
    update((g) => playMatchday(g));
    setVerResumen(true);
  };

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
    { ok: Boolean(s.club.director), texto: 'Director deportivo (opcional)', obligatoria: false, ir: () => go('direccion', 'director') },
  ];

  return (
    <>
      <Card>
        {s.phase === 'pretemporada' && (
          <>
            <h2>Pretemporada {s.season}</h2>
            <p className="muted small">Mercado abierto. Prepara el club antes de empezar:</p>
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

      {ofertasPendientes > 0 && (
        <button className="hint as-btn full-w" onClick={() => go('finanzas', 'patrocinadores')}>
          🤝 {ofertasPendientes} espacio(s) con ofertas de patrocinio sin firmar · Ver en Finanzas ›
        </button>
      )}

      {s.phase !== 'pretemporada' && <FansCard s={s} goPlantilla={() => go('equipo', 'plantilla')} />}

      {miUltimo && (
        <Card title={`Resultados jornada ${s.matchday}`} right={<button className="link" onClick={() => go('equipo', 'liga')}>Clasificación</button>}>
          {s.lastReport && s.lastReport.matchday === s.matchday && (
            <button className="btn full mb" onClick={() => setVerResumen(true)}>📋 Ver resumen de nuestro partido</button>
          )}
          <ul className="results">
            {s.lastResults.map((r, i) => {
              const mine = r.home === t.id || r.away === t.id;
              return (
                <li key={i} className={mine ? 'me' : ''}>
                  <span className="h">{teamById(s, r.home)!.name}</span>
                  <span className="score">{r.hg} - {r.ag}</span>
                  <span className="a">{teamById(s, r.away)!.name}</span>
                  {mine && r.attendance !== undefined && (
                    <span className="att">👥 {r.attendance.toLocaleString('es-ES')} espectadores · {s.club.identity.stadium}</span>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {verResumen && s.lastReport && <MatchSummary s={s} r={s.lastReport} onClose={() => setVerResumen(false)} />}
    </>
  );
}
