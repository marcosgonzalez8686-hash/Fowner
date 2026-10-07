import { fmtMoney } from '../game/economy';
import { rivalCrest } from '../game/identity';
import type { MatchReport, SideStats } from '../game/report';
import type { GameState } from '../game/types';
import { Sheet } from '../ui';
import Crest from './Crest';
import { RatingBadge } from './Rating';

const FILAS: { k: keyof SideStats; label: string; pct?: boolean }[] = [
  { k: 'possession', label: 'Posesión', pct: true },
  { k: 'shots', label: 'Tiros' },
  { k: 'onTarget', label: 'Tiros a puerta' },
  { k: 'corners', label: 'Córners' },
  { k: 'fouls', label: 'Faltas' },
  { k: 'yellows', label: 'Amarillas' },
  { k: 'reds', label: 'Rojas' },
];

const ICONO = { gol: '⚽', amarilla: '🟨', roja: '🟥', lesion: '🤕', ocasion: '🎯' } as const;

export default function MatchSummary({ s, r, onClose }: { s: GameState; r: MatchReport; onClose: () => void }) {
  const team = (id: number) => s.teams.find((t) => t.id === id)!;
  const mio = s.club.teamId;
  const crest = (id: number) => (id === mio ? s.club.identity.crest : rivalCrest(id, team(id).short));
  const nuestroLado = r.home === mio ? 'home' : 'away';
  const gf = nuestroLado === 'home' ? r.hg : r.ag;
  const gc = nuestroLado === 'home' ? r.ag : r.hg;
  let titulo = gf > gc ? '¡Victoria!' : gf < gc ? 'Derrota' : 'Empate';
  if (r.pens) {
    // penaltis: la tanda está en orden local-visitante
    const [pl, pv] = r.pens.split('-').map(Number);
    const ganamosPen = nuestroLado === 'home' ? pl > pv : pv > pl;
    titulo = ganamosPen ? '¡Pasamos en los penaltis!' : 'Fuera en los penaltis';
  }

  return (
    <Sheet title={`${r.label ?? `Jornada ${r.matchday}`} · ${titulo}`} onClose={onClose}>
      <div className="scoreboard">
        <div className={r.home === mio ? 'me' : ''}>
          <Crest c={crest(r.home)} size={46} />
          <span>{team(r.home).name}</span>
        </div>
        <div className="big-score">
          {r.hg} - {r.ag}
          {r.pens && <small className="pens">penaltis {r.pens}</small>}
        </div>
        <div className={r.away === mio ? 'me' : ''}>
          <Crest c={crest(r.away)} size={46} />
          <span>{team(r.away).name}</span>
        </div>
      </div>

      {r.events.some((e) => e.type !== 'ocasion') && (
        <ul className="events">
          {r.events.filter((e) => e.type !== 'ocasion').map((e, i) => (
            <li key={i} className={e.side}>
              <span className="min">{e.min}'</span>
              <span>
                {ICONO[e.type]} <b>{e.player}</b>
                {e.assist && <small className="muted"> (asist. {e.assist})</small>}
              </span>
            </li>
          ))}
        </ul>
      )}

      {r.keys?.length ? (
        <>
          <h4>🔎 Claves del partido</h4>
          <ul className="keys">
            {r.keys.map((k, i) => <li key={i}>{k}</li>)}
          </ul>
        </>
      ) : null}

      {r.lineups && (
        <>
          <h4>Notas de los jugadores</h4>
          <div className="ratings-grid">
            {(['home', 'away'] as const).map((side) => (
              <div key={side}>
                <div className="lineup-title">{team(side === 'home' ? r.home : r.away).short}</div>
                {r.lineups![side].map((p) => {
                  const goles = r.events.filter((e) => e.type === 'gol' && e.side === side && e.player === p.name).length;
                  const tarjeta = r.events.find((e) => (e.type === 'amarilla' || e.type === 'roja') && e.side === side && e.player === p.name);
                  return (
                    <div key={p.id} className={`rating-row${p.name === r.mvp.name ? ' mvp' : ''}`}>
                      <span className="pos-mini">{p.pos}</span>
                      <span className="rating-name">
                        {p.name.split(' ').slice(1).join(' ') || p.name}
                        {goles > 0 && ` ${'⚽'.repeat(goles)}`}
                        {tarjeta && (tarjeta.type === 'roja' ? ' 🟥' : ' 🟨')}
                      </span>
                      <RatingBadge v={p.rating} />
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </>
      )}

      <h4>Estadísticas</h4>
      <div className="stats">
        {FILAS.map(({ k, label, pct }) => {
          const h = r.stats.home[k];
          const a = r.stats.away[k];
          const tot = h + a || 1;
          return (
            <div key={k} className="stat-row">
              <span className="v">{h}{pct ? '%' : ''}</span>
              <div className="stat-mid">
                <span className="stat-label">{label}</span>
                <div className="stat-bar">
                  <i className={`h${r.home === mio ? ' mine' : ''}`} style={{ width: `${(h / tot) * 100}%` }} />
                  <i className={`a${r.away === mio ? ' mine' : ''}`} style={{ width: `${(a / tot) * 100}%` }} />
                </div>
              </div>
              <span className="v">{a}{pct ? '%' : ''}</span>
            </div>
          );
        })}
      </div>

      <div className="kpis">
        <div>
          <b>⭐ {r.mvp.name}</b>
          <span>
            Mejor jugador ({team(r.mvp.side === 'home' ? r.home : r.away).short}) · nota {r.mvp.rating.toFixed(1).replace('.', ',')}
          </span>
        </div>
        {r.attendance !== undefined ? (
          <div>
            <b>👥 {r.attendance.toLocaleString('es-ES')}</b>
            <span>espectadores{r.abonados ? ` (${r.abonados.toLocaleString('es-ES')} abonados)` : ''} · ingresos {fmtMoney(r.revenue ?? 0)}</span>
          </div>
        ) : (
          <div>
            <b>✈️ Fuera de casa</b>
            <span>sin ingresos de taquilla</span>
          </div>
        )}
      </div>

      <button className="btn primary full" onClick={onClose}>Continuar</button>
    </Sheet>
  );
}
