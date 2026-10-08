import { useState } from 'react';
import type { Update } from '../App';
import { DIV_LEVEL, fmtMoney, roundMoney } from '../game/economy';
import {
  askingPrice, askingSalary, marketOpen, myTeam, releasePlayer, renewSalary,
  teamById,
} from '../game/market';
import type { GameState, Player } from '../game/types';
import { Segmented, Sheet, Stepper } from '../ui';
import { YELLOW_LIMIT } from '../game/discipline';
import { seasonAverage } from '../game/history';
import { FormStrip, RatingBadge } from './Rating';
import { ProfileDetail } from './Traits';
import { MAX_LOANS_IN, loanAnswer, loanFee, loanTarget } from '../game/loans';
import { negFor, startLoanIn, startLoanOut, startPurchase, startRenewal } from '../game/negotiation';
import { TREND_TEXT, persuadeVeteran, trendOf } from '../game/aging';
import { potLabel, requestReport, shownPot } from '../game/scouting';
import { FLAG } from '../game/continental';
import { condition } from '../game/fatigue';
import { fatiguePenalty } from '../game/match';
import { TeamLink } from '../nav/context';
import { marketValue, valueTrend } from '../game/market';

/** Cuánto se ha revalorizado (o depreciado) esta temporada */
function Tendencia({ s, p }: { s: GameState; p: Player }) {
  const t = valueTrend(s, p);
  if (t === null || Math.abs(t) < 0.03) return null;
  return <span className={t > 0 ? 'pos' : 'neg'}>{t > 0 ? '📈 +' : '📉 '}{Math.round(t * 100)}% esta temporada</span>;
}

/** Condición física con lo que le resta en el campo */
export function Condicion({ p }: { p: Player }) {
  const c = condition(p);
  const pen = fatiguePenalty(p);
  return (
    <span className={c < 55 ? 'neg' : c < 70 ? 'warn' : undefined}>
      🔋 Condición física: <b>{c}%</b>
      {pen >= 0.1 ? ' · cansado: el entrenador puede darle descanso' : ''}
    </span>
  );
}

/** Paso de dinero adecuado para la cantidad */
const paso = (v: number) => (v >= 1_000_000 ? 50_000 : v >= 100_000 ? 5_000 : v >= 10_000 ? 1_000 : 100);

/** Busca un jugador en cualquier sitio (también en los clubes extranjeros de la Copa de Campeones) */
export function findPlayer(s: GameState, id: number): Player | undefined {
  return s.players.find((p) => p.id === id) ?? Object.values(s.continental?.squads ?? {}).flat().find((p) => p.id === id);
}

/** Ficha de cualquier jugador: la nuestra con renovar/vender/ceder; la de otro club con fichar/pedir cedido */
export default function PlayerSheet({ s, update, notify, id, onClose }: {
  s: GameState; update: Update; notify: (m: string) => void; id: number; onClose: () => void;
}) {
  const sel = findPlayer(s, id);
  const [anos, setAnos] = useState(sel && sel.teamId === s.club.teamId ? (sel.age >= 31 ? '1' : '2') : sel && sel.age <= 24 ? '3' : '2');
  // propuestas iniciales: algo por debajo de lo que piden
  const [oferta, setOferta] = useState(sel ? roundMoney(askingPrice(s, sel) * 0.85) : 0);
  const [sueldo, setSueldo] = useState(sel ? roundMoney(askingSalary(s, sel) * 0.9) : 0);
  const [cuota, setCuota] = useState(sel ? roundMoney(loanFee(s, sel) * 0.8) : 0);
  const [sueldoRenov, setSueldoRenov] = useState(sel ? roundMoney(renewSalary(sel) * 0.95) : 0);
  if (!sel) {
    return (
      <Sheet title="Jugador" onClose={onClose} top>
        <p className="muted">Este jugador ya no está en activo.</p>
      </Sheet>
    );
  }
  const run = (fn: () => string | undefined | void, ok: string) => {
    const err = fn();
    notify(err ?? ok);
    onClose();
  };
  const club = teamById(s, sel.teamId);
  const enCurso = negFor(s, sel.id);

  if (sel.teamId === s.club.teamId) {
    const cedidoA = Boolean(sel.loan && sel.loan.from !== s.club.teamId);
    const destino = !sel.loan ? loanTarget(s, sel) : undefined;
    return (
      <Sheet title={sel.name} onClose={onClose} top>
        <p className="muted">
          {sel.pos} · {sel.age} años · media {sel.ovr} · {potLabel(sel.ovr, shownPot(s, sel))}
          <br />
          Cobra {fmtMoney(sel.salary)}/temp. · contrato: {sel.contract} temp.
          <br />
          💰 Valor de mercado: <b>{fmtMoney(marketValue(s, sel))}</b> <Tendencia s={s} p={sel} />
          <br />
          <Condicion p={sel} />
          <br />
          {(sel.suspended ?? 0) > 0 && <><b className="neg">🟥 Sancionado: se pierde {sel.suspended! > 1 ? `los próximos ${sel.suspended} partidos` : 'el próximo partido'}</b><br /></>}
          {(sel.yellows ?? 0) > 0 && <>🟨 {sel.yellows} amarilla{sel.yellows! > 1 ? 's' : ''} esta temporada (con {YELLOW_LIMIT}, un partido de sanción)<br /></>}
          {TREND_TEXT[trendOf(sel)].icon} Está {TREND_TEXT[trendOf(sel)].text}
        </p>
        {sel.retiring && (
          <div className="hint warn-bg">
            👴 Ha anunciado que se retira al acabar la temporada.
            {!sel.persuaded ? (
              <button
                className="btn full"
                onClick={() => run(() => update((g) => persuadeVeteran(g, sel.id)), '')}
              >
                💬 Intentar convencerle de seguir un año más
              </button>
            ) : (
              <div className="small">Ya intentaste convencerle.</div>
            )}
          </div>
        )}

        <ProfileDetail s={s} p={sel} />

        <h4>Esta temporada</h4>
        {sel.season?.apps ? (
          <>
            <div className="kpis">
              <div><b>{sel.season.apps}</b><span>partidos</span></div>
              <div><b>{sel.season.goals}</b><span>goles</span></div>
              <div><b>{sel.season.assists}</b><span>asistencias</span></div>
              <div><b><RatingBadge v={seasonAverage(sel)!} /></b><span>nota media</span></div>
            </div>
            <p className="small">Últimas notas: <FormStrip form={sel.form} /></p>
          </>
        ) : (
          <p className="small muted">Aún no ha jugado esta temporada.</p>
        )}

        {cedidoA ? (
          <p className="hint">🔁 Cedido por el {teamById(s, sel.loan!.from)?.name} hasta final de temporada. Luego vuelve a su club.</p>
        ) : (
          <>
            {!sel.retiring && (
              <>
                <h4>Renovar</h4>
                {enCurso ? (
                  <p className="hint small">🤝 Hay una negociación abierta con él. Síguela en Equipo → Mercado.</p>
                ) : (
                  <>
                    <p className="small muted">
                      Cobra {fmtMoney(sel.salary)}/temp. Su agente habla de unos {fmtMoney(renewSalary(sel))}, aunque lo que pida dependerá de su temporada.
                      Te contestará {s.phase === 'pretemporada' ? 'la semana que viene' : 'tras la próxima jornada'}.
                    </p>
                    <Segmented
                      value={anos}
                      onChange={setAnos}
                      options={['1', '2', '3', '4'].map((v) => ({ value: v, label: `${v} año${v === '1' ? '' : 's'}` }))}
                    />
                    <Stepper value={sueldoRenov} step={paso(sueldoRenov)} min={0} onChange={setSueldoRenov} format={fmtMoney} />
                    <button
                      className="btn primary full"
                      onClick={() => run(() => update((g) => startRenewal(g, sel.id, sueldoRenov, Number(anos))), 'Propuesta de renovación enviada')}
                    >
                      📝 Ofrecer renovación ({fmtMoney(sueldoRenov)}/temp.)
                    </button>
                  </>
                )}
              </>
            )}

            <h4>Vender</h4>
            {enCurso ? (
              <p className="hint small">🤝 Hay una negociación abierta por él. Síguela en Equipo → Mercado.</p>
            ) : (
              <>
                <p className="small muted">
                  {sel.listed
                    ? 'Está en la lista de transferibles: los clubes lo saben y llegarán ofertas (algo más bajas).'
                    : 'Si lo pones como transferible, otros clubes se animarán a hacer ofertas.'}
                </p>
                <button className="btn full" onClick={() => run(() => update((g) => { const x = g.players.find((y) => y.id === sel.id); if (x) x.listed = !x.listed; }), sel.listed ? 'Ya no es transferible' : 'Ahora es transferible')}>
                  {sel.listed ? '🚫 Quitar de transferibles' : '🏷️ Poner como transferible'}
                </button>
              </>
            )}

            <h4>Rescindir</h4>
            <button
              className="btn danger full"
              onClick={() => run(() => update((g) => releasePlayer(g, sel.id).error), `${sel.name} queda libre`)}
            >
              Rescindir (cuesta {fmtMoney(roundMoney((sel.salary * Math.max(sel.contract, 1)) / 2))})
            </button>

            <h4>Ceder</h4>
            {destino && !enCurso ? (
              <>
                <p className="small muted">
                  Una temporada en el {destino.team.name} ({destino.division + 1}ª), que pagaría su ficha. A los jóvenes, jugar minutos les viene bien. Te contestarán {s.phase === 'pretemporada' ? 'la semana que viene' : 'tras la próxima jornada'}.
                </p>
                <button className="btn full" onClick={() => run(() => update((g) => startLoanOut(g, sel.id)), `Ofrecido cedido al ${destino.team.name}`)}>
                  🔁 Ofrecerlo cedido al {destino.team.name}
                </button>
              </>
            ) : (
              <p className="small muted">{enCurso ? 'Hay una negociación abierta por él.' : 'Nadie lo quiere cedido.'}</p>
            )}
          </>
        )}
      </Sheet>
    );
  }

  // jugador de otro club (o libre)
  const nivel = DIV_LEVEL[myTeam(s).division];
  const liga = s.leagueStats?.players[sel.id];
  const nuestroCedido = sel.loan?.from === s.club.teamId;
  return (
    <Sheet title={sel.name} onClose={onClose} top>
      <p className="muted">
        {sel.pos} · {sel.age} años · media {sel.ovr} · {potLabel(sel.ovr, shownPot(s, sel))}
        <br />
        💰 Valor de mercado: <b>{fmtMoney(marketValue(s, sel))}</b> <Tendencia s={s} p={sel} />
        <br />
        {club ? <TeamLink id={club.id}>{club.country ? `${FLAG[club.country] ?? ''} ${club.name}` : `${club.name} (${club.division + 1}ª)`}</TeamLink> : 'Agente libre'}
        {sel.ovr >= nivel + 4 ? ' · de los buenos para nuestra categoría' : ''}
      </p>
      {liga?.apps ? (
        <p className="small">
          Esta temporada: {liga.apps} partidos · {liga.goals} goles · {liga.assists} asistencias · nota media{' '}
          <RatingBadge v={Math.round((liga.rsum / liga.apps) * 10) / 10} />
        </p>
      ) : null}
      <ProfileDetail s={s} p={sel} fichaje onReport={() => notify(update((g) => requestReport(g, sel.id)) ?? '')} />
      {nuestroCedido ? (
        <p className="hint">🔁 Es nuestro, cedido esta temporada. Vuelve en verano.</p>
      ) : club?.country ? (
        <p className="small muted">Juega en el extranjero: no está en nuestro mercado.</p>
      ) : sel.loan ? (
        <p className="small muted">Está cedido: no se puede fichar hasta que vuelva a su club.</p>
      ) : (
        <>
          {enCurso ? (
            <p className="hint small">🤝 Ya hay una negociación abierta por él. Síguela en Equipo → Mercado.</p>
          ) : (
            <>
              <h4>{sel.teamId === null ? 'Ofrecer contrato' : `Oferta al ${club?.name ?? 'club'}`}</h4>
              <p className="small muted">
                {sel.teamId === null
                  ? `Es libre: solo hay que convencerle. Pide unos ${fmtMoney(askingSalary(s, sel))}/temp.`
                  : `Su club pide unos ${fmtMoney(askingPrice(s, sel))}. Primero se negocia el traspaso y después el contrato con el jugador.`}{' '}
                Te contestarán {s.phase === 'pretemporada' ? 'la semana que viene' : 'tras la próxima jornada'}.
                {!marketOpen(s) && ' Con el mercado cerrado se puede negociar igual: si hay acuerdo, llegará al abrirse el próximo mercado.'}
              </p>
              {sel.teamId !== null ? (
                <div className="row">
                  <Stepper value={oferta} step={paso(oferta)} min={0} onChange={setOferta} format={fmtMoney} />
                  <button className="btn primary grow" onClick={() => run(() => update((g) => startPurchase(g, sel.id, oferta, { years: Number(anos) })), 'Oferta enviada')}>
                    📨 Hacer oferta
                  </button>
                </div>
              ) : (
                <>
                  <Segmented
                    value={anos}
                    onChange={setAnos}
                    options={['1', '2', '3', '4'].map((v) => ({ value: v, label: `${v} año${v === '1' ? '' : 's'}` }))}
                  />
                  <div className="row">
                    <Stepper value={sueldo} step={paso(sueldo)} min={0} onChange={setSueldo} format={fmtMoney} />
                    <button className="btn primary grow" onClick={() => run(() => update((g) => startPurchase(g, sel.id, 0, { salary: sueldo, years: Number(anos) })), 'Oferta enviada')}>
                      📨 Ofrecer contrato
                    </button>
                  </div>
                </>
              )}
              {sel.teamId !== null && (() => {
                const r = loanAnswer(s, sel);
                return (
                  <>
                    <h4>Cesión</h4>
                    {r.ok ? (
                      <>
                        <p className="small muted">Hasta final de temporada: tú pagas su ficha ({fmtMoney(sel.salary)}) y una cuota al club. Máximo {MAX_LOANS_IN} cedidos.</p>
                        <div className="row">
                          <Stepper value={cuota} step={paso(cuota)} min={0} onChange={setCuota} format={fmtMoney} />
                          <button className="btn grow" onClick={() => run(() => update((g) => startLoanIn(g, sel.id, cuota)), 'Petición enviada')}>
                            🔁 Pedir cedido
                          </button>
                        </div>
                      </>
                    ) : (
                      <p className="small muted">{r.reason}</p>
                    )}
                  </>
                );
              })()}
            </>
          )}
        </>
      )}
    </Sheet>
  );
}
