import { useState } from 'react';
import type { ScreenProps } from '../App';
import { DIVISION_NAMES, DIVISIONS, PROMOTE } from '../game/economy';
import { myTeam, teamById } from '../game/market';
import { computeStandings } from '../game/match';
import { Card } from '../ui';

export default function Liga({ s }: ScreenProps) {
  const mia = myTeam(s);
  const [div, setDiv] = useState(mia.division);
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
    </>
  );
}
