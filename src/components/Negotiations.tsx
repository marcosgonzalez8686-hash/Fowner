import { useState } from 'react';
import type { Update } from '../App';
import { fmtMoney, roundMoney } from '../game/economy';
import { teamById } from '../game/market';
import { marketValue } from '../game/market';
import {
  acceptTerms, approveDeal, counter, isActive, resumenAcuerdo, saleAdvice, withdraw, type Negotiation,
} from '../game/negotiation';
import type { GameState } from '../game/types';
import { PlayerLink, TeamLink } from '../nav/context';
import { Card, Segmented, Stepper } from '../ui';

const TIPO: Record<Negotiation['kind'], string> = { compra: 'Fichaje', cesion: 'Cesión', venta: 'Oferta recibida', cedo: 'Cedemos', renovacion: 'Renovación' };

/** Cuándo llegará la respuesta */
const cuando = (s: GameState) => (s.phase === 'pretemporada' ? 'la semana que viene' : 'tras la próxima jornada');

/** Paso de dinero adecuado para la cantidad (para los botones + y −) */
const paso = (v: number) => (v >= 1_000_000 ? 50_000 : v >= 100_000 ? 5_000 : v >= 10_000 ? 1_000 : 100);

function Negociacion({ s, n, update, notify }: { s: GameState; n: Negotiation; update: Update; notify: (m: string) => void }) {
  const p = s.players.find((x) => x.id === n.playerId);
  const club = teamById(s, n.clubId);
  const pide = n.stage === 'club' ? n.counterFee ?? n.fee : n.counterSalary ?? n.salary;
  const ultima = n.stage === 'club' ? n.fee : n.salary;
  // propuesta por defecto: a medio camino entre lo nuestro y lo suyo
  const [oferta, setOferta] = useState(roundMoney(n.kind === 'venta' ? pide * 1.15 : (ultima + pide) / 2));
  const [anos, setAnos] = useState(String(n.years || 2));
  const hacer = (fn: (g: GameState) => string | undefined, ok: string) => {
    const r = update((g) => fn(g));
    notify(typeof r === 'string' ? r : ok);
  };
  if (!p) return null;
  const visto = n.state === 'tu_turno' && Boolean(n.approval);
  const tuTurno = n.state === 'tu_turno' && !visto;
  const delDirector = n.by === 'director';

  return (
    <div className={`offer negociacion${(tuTurno && !delDirector) || visto ? ' turn' : ''}`}>
      <div className="offer-head">
        <b><PlayerLink id={p.id}>{p.name}</PlayerLink></b>
        <span className="small muted">{TIPO[n.kind]}{club ? <> · <TeamLink id={club.id}>{club.short}</TeamLink></> : n.kind === 'compra' ? ' · libre' : ''}</span>
      </div>
      <div className="small muted">
        {p.pos} · {p.age} años · media {p.ovr} · valor {fmtMoney(marketValue(s, p))}
        {delDirector && ' · 💼 la lleva el director'}
      </div>
      {!(tuTurno && !delDirector) && !visto && <p className="small">{n.log[n.log.length - 1]}</p>}

      {visto && (
        <>
          <p className="small">📋 <b>El director tiene el acuerdo listo:</b> {resumenAcuerdo(s, n)}</p>
          <div className="row">
            <button className="btn primary grow" onClick={() => hacer((g) => approveDeal(g, n.id), 'Acuerdo aprobado')}>👍 Aprobar</button>
            <button className="btn grow" onClick={() => hacer((g) => withdraw(g, n.id), 'Acuerdo rechazado')}>Rechazar</button>
          </div>
        </>
      )}

      {n.state === 'esperando' && <p className="small muted">⏳ Esperando respuesta: llegará {cuando(s)}.</p>}
      {n.state === 'acordada' && (
        <p className="small">✍️ Acuerdo firmado: se hará efectivo cuando abra el mercado ({s.phase === 'temporada' && s.matchday < 18 ? 'jornada 19' : 'pretemporada'}).</p>
      )}

      {tuTurno && !delDirector && n.kind === 'venta' && (
        <>
          {s.club.director && <p className="small">💼 {saleAdvice(s, n).text}</p>}
          <div className="row">
            <button className="btn primary grow" onClick={() => hacer((g) => acceptTerms(g, n.id), 'Aceptada')}>Aceptar {fmtMoney(pide)}</button>
            <button className="btn grow" onClick={() => hacer((g) => withdraw(g, n.id), 'Oferta rechazada')}>Rechazar</button>
          </div>
          <p className="small">{n.log[n.log.length - 1]}</p>
          <Stepper value={oferta} step={paso(oferta)} min={pide} onChange={setOferta} format={fmtMoney} />
          <button className="btn full" onClick={() => hacer((g) => counter(g, n.id, { fee: oferta }), `Pides ${fmtMoney(oferta)}`)}>Pedir {fmtMoney(oferta)}</button>
        </>
      )}

      {tuTurno && !delDirector && n.kind !== 'venta' && (
        <>
          <p className="small">
            {n.stage === 'club'
              ? `${club?.name ?? 'El club'} pide ${fmtMoney(pide)}${n.kind === 'cesion' ? ' de cuota' : ''}.`
              : `${p.name} pide ${fmtMoney(pide)}/temp.`}
          </p>
          <div className="row">
            <button className="btn primary grow" onClick={() => hacer((g) => acceptTerms(g, n.id), 'Aceptado')}>Aceptar</button>
            <button className="btn grow" onClick={() => hacer((g) => withdraw(g, n.id), 'Te retiras')}>Retirarse</button>
          </div>
          <Stepper value={oferta} step={paso(oferta)} min={0} onChange={setOferta} format={fmtMoney} />
          <div className="row">
            <button
              className="btn grow"
              onClick={() =>
                hacer(
                  (g) => counter(g, n.id, n.stage === 'club' ? { fee: oferta } : { salary: oferta, years: Number(anos) }),
                  'Oferta enviada',
                )
              }
            >
              Contraofertar {fmtMoney(oferta)}{n.stage === 'jugador' ? '/temp.' : ''}
            </button>
          </div>
          {n.stage === 'jugador' && (
            <Segmented
              value={anos}
              onChange={setAnos}
              options={['1', '2', '3', '4'].map((v) => ({ value: v, label: `${v} año${v === '1' ? '' : 's'}` }))}
            />
          )}
        </>
      )}

      {(n.state === 'esperando' || (delDirector && tuTurno)) && n.kind !== 'venta' && (
        <button className="link small" onClick={() => hacer((g) => withdraw(g, n.id), 'Te retiras de la negociación')}>Retirarse</button>
      )}

      {n.log.length > 1 && (
        <details>
          <summary>Historial</summary>
          <ul className="satlog">
            {n.log.map((l, i) => <li key={i}>{l}</li>)}
          </ul>
        </details>
      )}
    </div>
  );
}

/** Negociaciones en marcha (y, si se pide, las últimas cerradas) */
export default function NegotiationsCard({ s, update, notify, onlyPending }: {
  s: GameState; update: Update; notify: (m: string) => void; onlyPending?: boolean;
}) {
  const abiertas = s.negotiations.filter((n) => (onlyPending ? n.state === 'tu_turno' && (n.by === 'dueño' || n.approval) : isActive(n)));
  const ventas = abiertas.filter((n) => n.kind === 'venta');
  const resto = abiertas.filter((n) => n.kind !== 'venta');
  const recientes = onlyPending ? [] : s.negotiations.filter((n) => !isActive(n) && n.season === s.season).slice(0, 8);
  if (!abiertas.length && !recientes.length) return null;
  return (
    <>
      {ventas.length > 0 && (
        <Card title={`📨 Ofertas por tus jugadores (${ventas.length})`}>
          <p className="small muted">
            {ventas.every((n) => n.by === 'director')
              ? 'Las negocia tu director deportivo: rechaza las que no valen y te pide el visto bueno cuando hay acuerdo.'
              : 'Puedes aceptar, rechazar o pedir más. Si tardas en contestar o pides demasiado, pueden retirarse.'}
          </p>
          {ventas.map((n) => <Negociacion key={`${n.id}-${n.log.length}`} s={s} n={n} update={update} notify={notify} />)}
        </Card>
      )}
      {(resto.length > 0 || recientes.length > 0) && (
        <Card title={`🤝 Negociaciones${resto.length ? ` (${resto.length})` : ''}`}>
          {resto.map((n) => <Negociacion key={`${n.id}-${n.stage}-${n.log.length}`} s={s} n={n} update={update} notify={notify} />)}
          {recientes.length > 0 && (
            <details>
              <summary>Últimas cerradas ({recientes.length})</summary>
              <ul className="satlog">
                {recientes.map((n) => (
                  <li key={n.id}>
                    {n.state === 'cerrada' ? '🤝' : '💔'} {TIPO[n.kind]}: {s.players.find((p) => p.id === n.playerId)?.name ?? '—'} · {n.log[n.log.length - 1]?.split(' · ').slice(1).join(' · ')}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </Card>
      )}
    </>
  );
}
