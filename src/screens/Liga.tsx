import { useState } from 'react';
import type { ScreenProps } from '../App';
import { DIRECT_UP, DIVISION_NAMES, DIVISIONS, PLAYOFF_FROM, PLAYOFF_TO, PROMOTE } from '../game/economy';
import { PLAYOFF_NAME, PLAYOFF_ROUNDS } from '../game/playoff';
import { flagOf, leagueName, leagueTable } from '../game/world';
import Selecciones from '../components/Selecciones';
import { myTeam, teamById } from '../game/market';
import { computeStandings } from '../game/match';
import { Card, Segmented } from '../ui';
import { RatingBadge } from '../components/Rating';
import { leaders } from '../game/stats';
import { PlayerLink, TeamLink } from '../nav/context';
import type { GameState } from '../game/types';

/** Ranking individual: nombre, equipo y cifra (los nuestros resaltados) */
function Ranking({ s, filas, valor }: { s: GameState; filas: { id: number; name: string; t: number }[]; valor: (i: number) => React.ReactNode }) {
  if (!filas.length) return <p className="muted small">Aún no hay datos.</p>;
  return (
    <ol className="rank">
      {filas.map((x, i) => (
        <li key={x.id} className={x.t === s.club.teamId ? 'me' : ''}>
          <span>
            <PlayerLink id={x.id}>{x.name}</PlayerLink> <small className="muted">{teamById(s, x.t)?.short}</small>
          </span>
          <b>{valor(i)}</b>
        </li>
      ))}
    </ol>
  );
}

function Estadisticas({ s, div }: { s: GameState; div: number }) {
  const l = leaders(s, div);
  const once = s.leagueStats?.bestXI[div];
  return (
    <>
      <Card title="⭐ Once de la jornada">
        {!once ? (
          <p className="muted small">Se elige al acabar cada jornada.</p>
        ) : (
          <>
            <p className="small muted">Jornada {once.matchday} · los mejores por nota en un 4-4-2</p>
            {once.xi.map((x) => (
              <div key={x.id} className={`rating-row${x.t === s.club.teamId ? ' mvp' : ''}`}>
                <span className="pos-mini">{x.pos}</span>
                <span className="rating-name"><PlayerLink id={x.id}>{x.name}</PlayerLink> <small className="muted">{teamById(s, x.t)?.short}</small></span>
                <RatingBadge v={x.rating} />
              </div>
            ))}
          </>
        )}
      </Card>
      <Card title="👟 Pichichi">
        <Ranking s={s} filas={l.goles} valor={(i) => l.goles[i].goals} />
      </Card>
      <Card title="🎯 Asistencias">
        <Ranking s={s} filas={l.asistencias} valor={(i) => l.asistencias[i].assists} />
      </Card>
      <Card title="📊 Mejor nota media">
        <Ranking s={s} filas={l.notas} valor={(i) => <RatingBadge v={Math.round(l.notas[i].avg * 10) / 10} />} />
        <p className="small muted">Mínimo {l.minimo} partidos jugados.</p>
      </Card>
    </>
  );
}

export default function Liga({ s }: ScreenProps) {
  const mia = myTeam(s);
  const [div, setDiv] = useState(mia.division);
  // otra liga (código de país) o las selecciones
  const [fuera, setFuera] = useState<string | null>(null);
  const [vista, setVista] = useState<'tabla' | 'stats'>('tabla');
  const ids = s.teams.filter((t) => t.division === div).map((t) => t.id);
  const tabla = computeStandings(ids, s.fixtures[div]);
  const n = tabla.length;

  return (
    <>
      <div className="chips">
        {Array.from({ length: DIVISIONS }, (_, d) => (
          <button key={d} className={d === div && !fuera ? 'on' : ''} onClick={() => { setDiv(d); setFuera(null); }}>
            {d + 1}ª{d === mia.division ? ' ★' : ''}
          </button>
        ))}
        {(s.world?.leagues ?? []).map((l) => (
          <button key={l.country} className={fuera === l.country ? 'on' : ''} onClick={() => setFuera(l.country)}>{flagOf(l.country)}</button>
        ))}
        <button className={fuera === 'SEL' ? 'on' : ''} onClick={() => setFuera('SEL')}>🌍 Selecciones</button>
      </div>
      {fuera === 'SEL' ? <Selecciones s={s} /> : fuera ? <LigaExtranjera s={s} code={fuera} /> : (<>
      <Segmented
        value={vista}
        onChange={(v) => setVista(v as 'tabla' | 'stats')}
        options={[{ value: 'tabla', label: 'Clasificación' }, { value: 'stats', label: 'Estadísticas' }]}
      />
      {vista === 'stats' ? <Estadisticas s={s} div={div} /> : (
      <Card title={DIVISION_NAMES[div]}>
        <table className="table">
          <thead>
            <tr>
              <th>#</th>
              <th className="left">Equipo</th>
              <th>PJ</th>
              <th>DG</th>
              <th>Pts</th>
            </tr>
          </thead>
          <tbody>
            {tabla.map((r, i) => {
              const t = teamById(s, r.teamId)!;
              const zona = div > 0 && i < DIRECT_UP ? 'up' : div > 0 && i >= PLAYOFF_FROM - 1 && i < PLAYOFF_TO ? 'playoff' : div < DIVISIONS - 1 && i >= n - PROMOTE ? 'down' : '';
              return (
                <tr key={r.teamId} className={`${zona} ${t.id === mia.id ? 'me' : ''}`}>
                  <td>{i + 1}</td>
                  <td className="left"><TeamLink id={t.id}>{t.name}</TeamLink></td>
                  <td>{r.pj}</td>
                  <td>{r.gf - r.gc > 0 ? '+' : ''}{r.gf - r.gc}</td>
                  <td><b>{r.pts}</b></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="legend">
          {div > 0 && <span className="up-dot">Ascenso</span>}
          {div > 0 && <span className="po-dot">Playoff ({PLAYOFF_FROM}º-{PLAYOFF_TO}º)</span>}
          {div < DIVISIONS - 1 && <span className="down-dot">Descenso</span>}
        </p>
      </Card>
      )}
      {vista === 'tabla' && <CuadroPlayoff s={s} div={div} />}
      </>)}
    </>
  );
}

/** Cuadro del playoff de ascenso de una categoría (al acabar la liga) */
function CuadroPlayoff({ s, div }: { s: GameState; div: number }) {
  const p = s.playoffs?.find((x) => x.division === div);
  if (!p) return null;
  const nombre = (id: number) => <TeamLink id={id}>{teamById(s, id)?.name ?? '—'}</TeamLink>;
  return (
    <Card title={`🔥 ${PLAYOFF_NAME}`}>
      {p.rounds.map((ronda, i) => (
        <div key={i}>
          <h4>{PLAYOFF_ROUNDS[i]}</h4>
          <ul className="results">
            {ronda.map((tie, j) => (
              <li key={j} className={tie.a === s.club.teamId || tie.b === s.club.teamId ? 'me' : ''}>
                <span className="h">{nombre(tie.a)}</span>
                <span className="score">{tie.winner === undefined ? 'vs' : `${tie.ga} - ${tie.gb}`}</span>
                <span className="a">{nombre(tie.b)}</span>
                {tie.pens && <span className="att">Penaltis: {tie.pens}</span>}
              </li>
            ))}
          </ul>
        </div>
      ))}
      <p className="small muted">
        {p.winner !== undefined ? <>⬆️ Sube: <b>{teamById(s, p.winner)?.name}</b></> : 'A partido único, en casa del mejor clasificado. El ganador de la final sube.'}
      </p>
    </Card>
  );
}

/** Clasificación de una liga extranjera (primera división de otro país) */
function LigaExtranjera({ s, code }: { s: GameState; code: string }) {
  const l = s.world?.leagues.find((x) => x.country === code);
  if (!l) return null;
  const tabla = leagueTable(l);
  return (
    <Card title={`${flagOf(code)} ${leagueName(code)}`}>
      <table className="table">
        <thead>
          <tr><th>#</th><th className="left">Equipo</th><th>PJ</th><th>DG</th><th>Pts</th></tr>
        </thead>
        <tbody>
          {tabla.map((r, i) => (
            <tr key={r.teamId}>
              <td>{i + 1}</td>
              <td className="left"><TeamLink id={r.teamId}>{teamById(s, r.teamId)!.name}</TeamLink></td>
              <td>{r.pj}</td>
              <td>{r.gf - r.gc > 0 ? '+' : ''}{r.gf - r.gc}</td>
              <td><b>{r.pts}</b></td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="small muted">18 clubes y 34 jornadas. Los primeros van a la Champions, la Europa League y la Conference (las plazas dependen del país). Puedes fichar a sus jugadores desde el Mercado.</p>
    </Card>
  );
}
