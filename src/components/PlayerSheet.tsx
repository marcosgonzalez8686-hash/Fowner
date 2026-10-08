import { useState } from 'react';
import type { Update } from '../App';
import { DIV_LEVEL, fmtMoney, playerValue, roundMoney } from '../game/economy';
import {
  askingPrice, askingSalary, buyPlayer, marketOpen, myTeam, releasePlayer, renewPlayer, renewSalary, sellPlayer, sellPrice,
  teamById,
} from '../game/market';
import type { GameState, Player } from '../game/types';
import { Segmented, Sheet } from '../ui';
import { seasonAverage } from '../game/history';
import { FormStrip, RatingBadge } from './Rating';
import { ProfileDetail } from './Traits';
import { LOAN_GROWTH_APPS, MAX_LOANS_IN, loanAnswer, loanFee, loanIn, loanOut, loanTarget } from '../game/loans';
import { PEAK, TREND_TEXT, persuadeVeteran, trendOf } from '../game/aging';
import { requestReport, shownPot } from '../game/scouting';
import { FLAG } from '../game/continental';
import { condition } from '../game/fatigue';
import { fatiguePenalty } from '../game/match';
import { TeamLink } from '../nav/context';

/** Condición física con lo que le resta en el campo */
export function Condicion({ p }: { p: Player }) {
  const c = condition(p);
  const pen = fatiguePenalty(p);
  return (
    <span className={c < 55 ? 'neg' : c < 70 ? 'warn' : undefined}>
      🔋 Condición física: <b>{c}%</b>
      {pen >= 0.1 ? ` (cansado: −${pen.toFixed(1).replace('.', ',')} en el campo; el entrenador puede darle descanso)` : ''}
    </span>
  );
}

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

  if (sel.teamId === s.club.teamId) {
    const cedidoA = Boolean(sel.loan && sel.loan.from !== s.club.teamId);
    const destino = !sel.loan ? loanTarget(s, sel) : undefined;
    return (
      <Sheet title={sel.name} onClose={onClose} top>
        <p className="muted">
          {sel.pos} · {sel.age} años · media {sel.ovr} · potencial {sel.pot}
          <br />
          Cobra {fmtMoney(sel.salary)}/temp. · contrato: {sel.contract} temp.
          <br />
          💰 Valor de mercado: <b>{fmtMoney(playerValue(sel))}</b>
          <br />
          <Condicion p={sel} />
          <br />
          {TREND_TEXT[trendOf(sel)].icon} Está {TREND_TEXT[trendOf(sel)].text}
          {trendOf(sel) !== 'crece' && ` (un ${sel.pos === 'POR' ? 'portero' : sel.pos === 'DEF' ? 'defensa' : sel.pos === 'MED' ? 'centrocampista' : 'delantero'} aguanta hasta los ${PEAK[sel.pos]})`}
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
                <p className="small">Pide {fmtMoney(renewSalary(sel))}/temp.</p>
                <Segmented
                  value={anos}
                  onChange={setAnos}
                  options={['1', '2', '3', '4'].map((v) => ({ value: v, label: `${v} año${v === '1' ? '' : 's'}` }))}
                />
                <button
                  className="btn primary full"
                  onClick={() => run(() => update((g) => renewPlayer(g, sel.id, renewSalary(sel), Number(anos)).error), 'Renovado')}
                >
                  Renovar
                </button>
              </>
            )}

            <h4>Vender</h4>
            {marketOpen(s) ? (
              <button
                className="btn full"
                onClick={() => run(() => update((g) => sellPlayer(g, sel.id, sellPrice(sel)).error), `Vendido por ${fmtMoney(sellPrice(sel))}`)}
              >
                Aceptar oferta de {fmtMoney(sellPrice(sel))}
              </button>
            ) : (
              <p className="small muted">El mercado está cerrado.</p>
            )}

            <h4>Rescindir</h4>
            <button
              className="btn danger full"
              onClick={() => run(() => update((g) => releasePlayer(g, sel.id).error), `${sel.name} queda libre`)}
            >
              Rescindir (cuesta {fmtMoney(roundMoney((sel.salary * Math.max(sel.contract, 1)) / 2))})
            </button>

            <h4>Ceder</h4>
            {marketOpen(s) && destino ? (
              <>
                <p className="small muted">
                  Una temporada en el {destino.team.name} ({destino.division + 1}ª), que paga su ficha. Si tiene 23 años o menos y juega {LOAN_GROWTH_APPS} partidos o más, vuelve mejor.
                </p>
                <button className="btn full" onClick={() => run(() => update((g) => loanOut(g, sel.id)), '')}>
                  🔁 Ceder al {destino.team.name}
                </button>
              </>
            ) : (
              <p className="small muted">{marketOpen(s) ? 'Nadie lo quiere cedido.' : 'Solo con el mercado abierto.'}</p>
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
        {sel.pos} · {sel.age} años · media {sel.ovr} · potencial {shownPot(s, sel)}
        <br />
        💰 Valor de mercado: <b>{fmtMoney(playerValue(sel))}</b>
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
      ) : !marketOpen(s) ? (
        <p className="small muted">🔒 Mercado cerrado: podrás ficharlo en pretemporada o en el parón de invierno (jornadas 19 a 21).</p>
      ) : sel.loan ? (
        <p className="small muted">Está cedido: no se puede fichar hasta que vuelva a su club.</p>
      ) : (
        <>
          <div className="kpis">
            <div><b>{fmtMoney(askingPrice(sel))}</b><span>traspaso</span></div>
            <div><b>{fmtMoney(askingSalary(s, sel))}</b><span>ficha/temp.</span></div>
          </div>
          <h4>Duración del contrato</h4>
          <Segmented
            value={anos}
            onChange={setAnos}
            options={['1', '2', '3', '4'].map((v) => ({ value: v, label: `${v} año${v === '1' ? '' : 's'}` }))}
          />
          <button
            className="btn primary full"
            onClick={() => {
              const err = update((g) => buyPlayer(g, sel.id, askingPrice(sel), askingSalary(s, sel), Number(anos)).error);
              notify(err ?? `¡${sel.name} es nuevo jugador del club!`);
              onClose();
            }}
          >
            Fichar
          </button>
          {sel.teamId !== null && (() => {
            const r = loanAnswer(s, sel);
            return (
              <>
                <h4>Cesión</h4>
                {r.ok ? (
                  <>
                    <p className="small muted">Hasta final de temporada. Cuota {fmtMoney(loanFee(sel))} y pagas su ficha ({fmtMoney(sel.salary)}). Máximo {MAX_LOANS_IN} cedidos.</p>
                    <button
                      className="btn full"
                      onClick={() => {
                        notify(update((g) => loanIn(g, sel.id)) ?? '');
                        onClose();
                      }}
                    >
                      🔁 Pedir cedido
                    </button>
                  </>
                ) : (
                  <p className="small muted">{r.reason}</p>
                )}
              </>
            );
          })()}
        </>
      )}
    </Sheet>
  );
}
