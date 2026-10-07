import { useState } from 'react';
import type { ScreenProps } from '../App';
import { DIVISION_NAMES, DIVISIONS, PROMOTE } from '../game/economy';
import { myTeam, teamById } from '../game/market';
import { computeStandings } from '../game/match';
import { Card, Segmented } from '../ui';
import { RatingBadge } from '../components/Rating';
import { leaders } from '../game/stats';
import type { GameState } from '../game/types';

/** Ranking individual: nombre, equipo y cifra (los nuestros resaltados) */
function Ranking({ s, filas, valor }: { s: GameState; filas: { id: number; name: string; t: number }[]; valor: (i: number) => React.ReactNode }) {
  if (!filas.length) return <p className="muted small">Aún no hay datos.</p>;
  return (
    <ol className="rank">
      {filas.map((x, i) => (
        <li key={x.id} className={x.t === s.club.teamId ? 'me' : ''}>
          <span>
            {x.name} <small className="muted">{teamById(s, x.t)?.short}</small>
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
                <span className="rating-name">{x.name} <small className="muted">{teamById(s, x.t)?.short}</small></span>
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
  const [vista, setVista] = useState<'tabla' | 'stats'>('tabla');
  const ids = s.teams.filter((t) => t.division === div).map((t) => t.id);
  const tabla = computeStandings(ids, s.fixtures[div]);
  const n = tabla.length;

  return (
    <>
      <div className="chips">
        {Array.from({ length: DIVISIONS }, (_, d) => (
          <button key={d} className={d === div ? 'on' : ''} onClick={() => setDiv(d)}>
            {d + 1}ª{d === mia.division ? ' ★' : ''}
          </button>
        ))}
      </div>
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
              const zona = div > 0 && i < PROMOTE ? 'up' : div < DIVISIONS - 1 && i >= n - PROMOTE ? 'down' : '';
              return (
                <tr key={r.teamId} className={`${zona} ${t.id === mia.id ? 'me' : ''}`}>
                  <td>{i + 1}</td>
                  <td className="left">{t.name}</td>
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
          {div < DIVISIONS - 1 && <span className="down-dot">Descenso</span>}
        </p>
      </Card>
      )}
    </>
  );
}
