import { useState, type PointerEvent } from 'react';
import type { ScreenProps } from '../App';
import Crest from '../components/Crest';
import { DIVISION_NAMES, DIVISIONS, TEAMS_PER_DIV } from '../game/economy';
import { pyramidRank, type SeasonRecord } from '../game/history';
import { LEGEND_APPS } from '../game/aging';
import { Card } from '../ui';
import { PlayerLink } from '../nav/context';

const MEDALLA = (nombre: string) => (nombre.startsWith('Liga') ? '🥇' : '🏆');

/** Trayectoria en la pirámide: arriba Primera, abajo la Liga Comarcal */
function Trayectoria({ seasons }: { seasons: SeasonRecord[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 340;
  const H = 170;
  const pad = { l: 34, r: 10, t: 10, b: 20 };
  // solo el tramo de divisiones por el que ha pasado el club (y una por encima, para ver la meta)
  const dMin = Math.max(0, Math.min(...seasons.map((x) => x.division)) - 1);
  const dMax = Math.min(DIVISIONS - 1, Math.max(...seasons.map((x) => x.division)));
  const top = dMin * TEAMS_PER_DIV + 1;
  const max = (dMax + 1) * TEAMS_PER_DIV;
  const n = seasons.length;
  const x = (i: number) => pad.l + (n === 1 ? (W - pad.l - pad.r) / 2 : (i / (n - 1)) * (W - pad.l - pad.r));
  const y = (rank: number) => pad.t + ((rank - top) / (max - top)) * (H - pad.t - pad.b);
  const pts = seasons.map((s, i) => [x(i), y(pyramidRank(s))] as const);
  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    let mejor = 0;
    pts.forEach(([cx], i) => { if (Math.abs(cx - px) < Math.abs(pts[mejor][0] - px)) mejor = i; });
    setHover(mejor);
  };
  const sel = hover !== null ? seasons[hover] : seasons[n - 1];
  return (
    <div className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Trayectoria del club en las divisiones" onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setHover(null)}>
        {DIVISION_NAMES.map((_, d) => {
          if (d < dMin || d > dMax) return null;
          const y0 = y(d * TEAMS_PER_DIV + 1);
          const y1 = y((d + 1) * TEAMS_PER_DIV);
          return (
            <g key={d}>
              {d % 2 === 0 && <rect x={pad.l} y={y0 - 2} width={W - pad.l - pad.r} height={y1 - y0 + 4} className="band" />}
              <text x={pad.l - 6} y={(y0 + y1) / 2 + 3} className="tick" textAnchor="end">{d + 1}ª</text>
            </g>
          );
        })}
        {n > 1 && <path d={pts.map(([px, py], i) => `${i ? 'L' : 'M'}${px.toFixed(1)},${py.toFixed(1)}`).join('')} className="line s1" />}
        {pts.map(([px, py], i) => (
          <circle key={i} cx={px} cy={py} r={hover === i ? 5.5 : 4} className={`dot s1${hover === i ? ' ring' : ''}`} />
        ))}
      </svg>
      <div className="chart-foot">
        <b>T{sel.season}</b> · {sel.position}º en {DIVISION_NAMES[sel.division]}
        {sel.promoted ? ' · ⬆️ ascenso' : sel.relegated ? ' · ⬇️ descenso' : ''}
      </div>
    </div>
  );
}

export default function Historia({ s }: ScreenProps) {
  const c = s.club;
  const rec = c.records;
  const temporadas = [...rec.seasons].reverse();
  const jugadores = Object.entries(rec.players).map(([id, v]) => ({ id: Number(id), ...v }));
  const vivos = new Set(s.players.map((p) => p.id));
  const enClub = new Set(s.players.filter((p) => p.teamId === c.teamId).map((p) => p.id));
  const goleadores = [...jugadores].filter((x) => x.goals > 0).sort((a, b) => b.goals - a.goals).slice(0, 10);
  const presencias = [...jugadores].sort((a, b) => b.apps - a.apps).slice(0, 10);
  const mejor = rec.seasons.length ? [...rec.seasons].sort((a, b) => pyramidRank(a) - pyramidRank(b))[0] : null;
  const masPuntos = rec.seasons.filter((x) => x.points !== undefined).sort((a, b) => (b.points ?? 0) - (a.points ?? 0))[0];
  const ascensos = rec.seasons.filter((x) => x.promoted).length;

  return (
    <>
      <Card>
        <div className="club-hero">
          <Crest c={c.identity.crest} size={64} />
          <div>
            <b>{s.teams.find((t) => t.id === c.teamId)!.name}</b>
            <div className="small muted">Presidente: {c.identity.ownerName} {c.identity.ownerSurname} · desde la temporada 1</div>
            <div className="small muted">🏟️ {c.identity.stadium} · {c.capacity.toLocaleString('es-ES')} espectadores</div>
          </div>
        </div>
        <div className="kpis">
          <div><b>{c.trophies.length}</b><span>títulos</span></div>
          <div><b>{ascensos}</b><span>ascensos</span></div>
          <div><b>{rec.seasons.length}</b><span>temporadas completadas</span></div>
          <div><b>{mejor ? `${mejor.position}º ${DIVISION_NAMES[mejor.division].replace(' División', '')}` : '—'}</b><span>mejor clasificación</span></div>
        </div>
      </Card>

      <Card title="🏆 Sala de trofeos">
        {c.trophies.length === 0 ? (
          <p className="muted small">Aún no hay títulos. Gana la liga de tu categoría o la Copa para estrenar la vitrina.</p>
        ) : (
          <div className="trophies">
            {c.trophies.map((x, i) => (
              <div key={i} className="trophy">
                <span className="trophy-ico">{MEDALLA(x.name)}</span>
                <b>{x.name.replace('Liga · ', '')}</b>
                <small>Temporada {x.season}</small>
              </div>
            ))}
          </div>
        )}
      </Card>

      {rec.seasons.length > 0 && (
        <Card title="📈 Trayectoria">
          <Trayectoria seasons={rec.seasons} />
        </Card>
      )}

      <Card title="📅 Temporada a temporada">
        {temporadas.length === 0 ? (
          <p className="muted small">Al terminar la primera temporada empezará a escribirse la historia del club.</p>
        ) : (
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th className="left">Temp.</th>
                  <th className="left">División</th>
                  <th>Pos</th>
                  <th>Pts</th>
                  <th>Goles</th>
                  <th className="left">Copa</th>
                  <th className="left">Pichichi</th>
                  <th className="left">Mejor jugador</th>
                </tr>
              </thead>
              <tbody>
                {temporadas.map((x) => (
                  <tr key={x.season} className={x.champion ? 'me' : x.promoted ? 'up' : x.relegated ? 'down' : ''}>
                    <td className="left">T{x.season}</td>
                    <td className="left">{DIVISION_NAMES[x.division].replace(' División', '').replace(' Categoría', '')}</td>
                    <td>{x.position}º{x.champion ? ' 🥇' : x.promoted ? ' ⬆️' : x.relegated ? ' ⬇️' : ''}</td>
                    <td>{x.points ?? '—'}</td>
                    <td>{x.gf !== undefined ? `${x.gf}:${x.gc}` : '—'}</td>
                    <td className="left">{x.cup ?? '—'}{x.cup === 'Campeón' ? ' 🏆' : ''}</td>
                    <td className="left">{x.topScorer ? `${x.topScorer.name} (${x.topScorer.goals})` : '—'}</td>
                    <td className="left">{x.bestPlayer ? `${x.bestPlayer.name} (${x.bestPlayer.rating.toFixed(1).replace('.', ',')})` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="📌 Récords">
        <table className="table money">
          <tbody>
            <tr>
              <td className="left">Mayor victoria</td>
              <td>{rec.bigWin ? `${rec.bigWin.gf}-${rec.bigWin.gc} al ${rec.bigWin.rival} (T${rec.bigWin.season})` : '—'}</td>
            </tr>
            <tr>
              <td className="left">Peor derrota</td>
              <td>{rec.bigLoss ? `${rec.bigLoss.gf}-${rec.bigLoss.gc} ante el ${rec.bigLoss.rival} (T${rec.bigLoss.season})` : '—'}</td>
            </tr>
            <tr>
              <td className="left">Récord de asistencia</td>
              <td>{rec.attendance ? `${rec.attendance.value.toLocaleString('es-ES')} ante el ${rec.attendance.rival} (T${rec.attendance.season})` : '—'}</td>
            </tr>
            <tr>
              <td className="left">Más puntos en una liga</td>
              <td>{masPuntos ? `${masPuntos.points} (T${masPuntos.season})` : '—'}</td>
            </tr>
          </tbody>
        </table>
      </Card>

      {(rec.retired?.length ?? 0) > 0 && (
        <Card title="🎖️ Retirados en el club">
          <table className="table">
            <thead>
              <tr>
                <th className="left">Jugador</th>
                <th>Temp.</th>
                <th>PJ</th>
                <th>Goles</th>
              </tr>
            </thead>
            <tbody>
              {[...rec.retired!].reverse().map((x, i) => (
                <tr key={i}>
                  <td className="left">{x.tribute ? '🎖️ ' : ''}{x.name} <span className="muted small">{x.pos} · {x.age} años</span></td>
                  <td>T{x.season}</td>
                  <td>{x.apps}</td>
                  <td>{x.goals}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="small muted">🎖️ Con partido homenaje ({LEGEND_APPS} partidos o más en el club).</p>
        </Card>
      )}

      <Card title="⭐ Leyendas del club">
        <div className="legends">
          <div>
            <h4>Máximos goleadores</h4>
            {goleadores.length === 0 && <p className="muted small">Todavía nadie ha marcado.</p>}
            <ol className="rank">
              {goleadores.map((x) => (
                <li key={x.id}>
                  <span><PlayerLink id={vivos.has(x.id) ? x.id : undefined}>{x.name}</PlayerLink>{enClub.has(x.id) ? '' : ' ·'}</span>
                  <b>{x.goals}</b>
                </li>
              ))}
            </ol>
          </div>
          <div>
            <h4>Más partidos</h4>
            {presencias.length === 0 && <p className="muted small">Sin partidos jugados.</p>}
            <ol className="rank">
              {presencias.map((x) => (
                <li key={x.id}>
                  <span><PlayerLink id={vivos.has(x.id) ? x.id : undefined}>{x.name}</PlayerLink>{enClub.has(x.id) ? '' : ' ·'}</span>
                  <b>{x.apps}</b>
                </li>
              ))}
            </ol>
          </div>
        </div>
        <p className="small muted">Liga y Copa. Con «·», jugadores que ya no están en el club.</p>
      </Card>
    </>
  );
}
