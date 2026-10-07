import { useState } from 'react';
import type { ScreenProps } from '../App';
import { executeProposal } from '../game/director';
import { MATCHDAYS } from '../game/economy';
import { marketOpen, myTeam, squadOf, teamById } from '../game/market';
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

const FROM_ICON: Record<Message['from'], string> = { director: '💼', club: '🏛️', liga: '🏆', prensa: '📰' };

function nextMatch(s: GameState) {
  const t = myTeam(s);
  if (s.phase !== 'temporada') return null;
  const f = s.fixtures[t.division][s.matchday].find((x) => x.home === t.id || x.away === t.id)!;
  const rivalId = f.home === t.id ? f.away : f.home;
  return { casa: f.home === t.id, rival: teamById(s, rivalId)! };
}

export default function Inicio({ s, update, notify, go }: ScreenProps) {
  const [abierto, setAbierto] = useState<number | null>(null);
  const [verResumen, setVerResumen] = useState(false);
  const faltaCamiseta = !s.club.sponsors.camiseta && Boolean(s.sponsorOffers.camiseta?.length);
  const ofertasPendientes = Object.values(s.sponsorOffers).filter((o) => o?.length).length;
  const t = myTeam(s);
  const prox = nextMatch(s);
  const tabla = computeStandings(s.teams.filter((x) => x.division === t.division).map((x) => x.id), s.fixtures[t.division]);
  const pos = tabla.findIndex((r) => r.teamId === t.id) + 1;
  const mia = bestEleven(squadOf(s, t.id)).strength;
  const pendientes = s.messages.filter((m) => m.status === 'pendiente');
  const resto = s.messages.filter((m) => m.status !== 'pendiente').slice(0, 25);
  const miUltimo = s.lastResults.find((r) => r.home === t.id || r.away === t.id);

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

  return (
    <>
      <Card>
        {s.phase === 'pretemporada' && (
          <>
            <h2>Pretemporada {s.season}</h2>
            <p className="muted">
              Mercado abierto. Ficha, decide la cantera y ajusta el club antes de empezar.
            </p>
            {!s.club.staff.entrenador && (
              <p className="hint warn-bg">⚠️ No tienes entrenador. Contrátalo en Club → Empleados.</p>
            )}
            <button
              className="btn primary big"
              disabled={faltaCamiseta}
              onClick={() => {
                const err = update((g) => startSeason(g));
                if (err) notify(err);
              }}
            >
              Empezar temporada
            </button>
            {faltaCamiseta && <p className="small muted">Primero firma un patrocinador de camiseta ↓</p>}
          </>
        )}
        {prox && (
          <>
            <div className="match-head">
              <span className="muted">Jornada {s.matchday + 1} de {MATCHDAYS}</span>
              <span className="muted">{pos}º en la liga</span>
            </div>
            <div className="versus">
              {prox.casa ? nosotros : ellos}
              <div className="vs">vs</div>
              {prox.casa ? ellos : nosotros}
            </div>
            <div className="kit-line">
              <KitView k={prox.casa ? s.club.identity.home : s.club.identity.away} size={26} />
              <span className="muted small">
                {prox.casa ? `En casa, en el ${s.club.identity.stadium}, con la titular` : 'Fuera de casa, con la suplente'}
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
            {marketOpen(s) && <p className="hint">🔁 Mercado de invierno abierto</p>}
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

      {s.phase === 'pretemporada' && faltaCamiseta && (
        <Card title="👕 Patrocinador de camiseta">
          <p className="small muted">
            Tres empresas quieren poner su nombre en tu camiseta. Elige una para poder empezar la temporada.
            El resto de patrocinios están en Club → Finanzas.
          </p>
          <SlotOffers s={s} slot="camiseta" update={update} notify={notify} />
        </Card>
      )}

      {ofertasPendientes > 0 && !faltaCamiseta && (
        <button className="hint as-btn full-w" onClick={() => go('club')}>
          🤝 Tienes {ofertasPendientes} espacio(s) con ofertas de patrocinio sin firmar. Ver en Club → Finanzas ›
        </button>
      )}

      {miUltimo && (
        <Card title={`Resultados jornada ${s.matchday}`} right={<button className="link" onClick={() => go('liga')}>Clasificación</button>}>
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
                    <span className="att">👥 {r.attendance.toLocaleString('es-ES')} espectadores en el {s.club.identity.stadium}</span>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {pendientes.length > 0 && (
        <Card title={`Pendiente de tu decisión (${pendientes.length})`}>
          {pendientes.map((m) => (
            <div key={m.id} className="msg pending">
              <div className="msg-title">💼 {m.title.replace(/^Propuesta: /, '')}</div>
              <p className="pre">{m.body}</p>
              <div className="row">
                <button className="btn primary grow" onClick={() => responder(m, true)}>Aprobar</button>
                <button className="btn grow" onClick={() => responder(m, false)}>Rechazar</button>
              </div>
            </div>
          ))}
        </Card>
      )}

      <Card title="Bandeja">
        {resto.length === 0 && <p className="muted">Sin mensajes.</p>}
        {resto.map((m) => (
          <div key={m.id} className={`msg${m.read ? '' : ' unread'}`}>
            <button
              className="msg-title as-btn"
              onClick={() => {
                setAbierto(abierto === m.id ? null : m.id);
                if (!m.read) update((g) => { g.messages.find((x) => x.id === m.id)!.read = true; });
              }}
            >
              <span>{FROM_ICON[m.from]} {m.title}</span>
              <span className="muted small">
                {m.status && m.status !== 'pendiente' ? `${m.status} · ` : ''}T{m.season} J{m.matchday}
              </span>
            </button>
            {abierto === m.id && <p className="pre">{m.body}</p>}
          </div>
        ))}
      </Card>
      {verResumen && s.lastReport && <MatchSummary s={s} r={s.lastReport} onClose={() => setVerResumen(false)} />}
    </>
  );
}
