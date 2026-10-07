import { rivalCrest } from '../game/identity';
import { squadOf, teamById } from '../game/market';
import { STYLES, bestEleven, chooseStyle, computeStandings, form, type Formation } from '../game/match';
import { moraleBonus, moraleLabel } from '../game/morale';
import { staffMatchBonus } from '../game/staff';
import type { GameState, Player } from '../game/types';
import Crest from './Crest';

export interface MatchSetup {
  comp: 'liga' | 'copa';
  label: string; // "Jornada 5" o "Copa · Octavos"
  homeId: number;
  awayId: number;
  neutral?: boolean;
}

const LINEAS: Player['pos'][] = ['DEL', 'MED', 'DEF', 'POR'];
const apellido = (n: string) => n.split(' ').slice(1).join(' ') || n;

/** Once dibujado sobre medio campo, por líneas */
function Pitch({ xi, flip }: { xi: Player[]; flip?: boolean }) {
  const lineas = flip ? [...LINEAS].reverse() : LINEAS;
  return (
    <div className="pitch">
      {lineas.map((pos) => {
        const deEsa = xi.filter((p) => p.pos === pos);
        if (!deEsa.length) return null;
        return (
          <div key={pos} className="pitch-row">
            {deEsa.map((p) => (
              <span key={p.id} className={`pitch-player pos-${p.pos}`}>
                <b>{p.ovr}</b>
                <small>{apellido(p.name)}</small>
              </span>
            ))}
          </div>
        );
      })}
    </div>
  );
}

function teamInfo({ s, id, rivalId, home, neutral }: { s: GameState; id: number; rivalId: number; home: boolean; neutral?: boolean }) {
  const t = teamById(s, id)!;
  const mio = id === s.club.teamId;
  const plan = bestEleven(squadOf(s, id));
  const rival = bestEleven(squadOf(s, rivalId));
  const extra = (x: number) => (x === s.club.teamId ? staffMatchBonus(s) + moraleBonus(s) : 0);
  const estilo = chooseStyle(plan.strength + extra(id), rival.strength + extra(rivalId), home && !neutral);
  const bajas = squadOf(s, id).filter((p) => (p.injury ?? 0) > 0);
  return { t, mio, plan, estilo, bajas };
}

export default function Previa({ s, setup, onPlay, onSkip, onClose }: {
  s: GameState; setup: MatchSetup; onPlay: () => void; onSkip: () => void; onClose: () => void;
}) {
  const h = teamInfo({ s, id: setup.homeId, rivalId: setup.awayId, home: true, neutral: setup.neutral });
  const a = teamInfo({ s, id: setup.awayId, rivalId: setup.homeId, home: false, neutral: setup.neutral });
  const crest = (x: ReturnType<typeof teamInfo>) => (x.mio ? s.club.identity.crest : rivalCrest(x.t.id, x.t.short));

  // datos de liga: posición, puntos y racha
  const liga = setup.comp === 'liga' && h.t.division === a.t.division
    ? (() => {
        const tabla = computeStandings(s.teams.filter((x) => x.division === h.t.division).map((x) => x.id), s.fixtures[h.t.division]);
        const fila = (id: number) => ({ pos: tabla.findIndex((r) => r.teamId === id) + 1, row: tabla.find((r) => r.teamId === id)! });
        return { h: fila(h.t.id), a: fila(a.t.id) };
      })()
    : null;
  const maxF = Math.max(h.plan.strength, a.plan.strength);
  const estadio = setup.neutral ? 'Campo neutral' : h.mio ? s.club.identity.stadium : `Estadio del ${h.t.name}`;
  const nuestro = h.mio ? h : a.mio ? a : null;

  return (
    <div className="overlay" role="dialog" aria-label="Previa del partido">
      <div className="overlay-inner">
        <div className="sheet-head">
          <h3>📋 Previa · {setup.label}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>
        <p className="small muted center">🏟️ {estadio}</p>

        <div className="scoreboard">
          <div className={h.mio ? 'me' : ''}>
            <Crest c={crest(h)} size={52} />
            <span>{h.t.name}</span>
            <small className="muted">{h.t.division + 1}ª división</small>
          </div>
          <div className="vs">vs</div>
          <div className={a.mio ? 'me' : ''}>
            <Crest c={crest(a)} size={52} />
            <span>{a.t.name}</span>
            <small className="muted">{a.t.division + 1}ª división</small>
          </div>
        </div>

        {liga && (
          <table className="table compare">
            <tbody>
              <tr>
                <td>{liga.h.row.pj ? `${liga.h.pos}º` : '—'}</td>
                <th>Posición</th>
                <td>{liga.a.row.pj ? `${liga.a.pos}º` : '—'}</td>
              </tr>
              <tr><td>{liga.h.row.pts}</td><th>Puntos</th><td>{liga.a.row.pts}</td></tr>
              <tr><td>{liga.h.row.g}-{liga.h.row.e}-{liga.h.row.p}</td><th>G-E-P</th><td>{liga.a.row.g}-{liga.a.row.e}-{liga.a.row.p}</td></tr>
              <tr><td>{liga.h.row.gf}:{liga.h.row.gc}</td><th>Goles</th><td>{liga.a.row.gf}:{liga.a.row.gc}</td></tr>
              <tr>
                <td>{form(h.t.id, s.fixtures[h.t.division]).join(' ') || '—'}</td>
                <th>Racha</th>
                <td>{form(a.t.id, s.fixtures[a.t.division]).join(' ') || '—'}</td>
              </tr>
            </tbody>
          </table>
        )}

        <h4>Nivel del once</h4>
        <div className="duel">
          <span>{h.plan.strength.toFixed(1)}</span>
          <div className="duel-bars">
            <i className={h.mio ? 'mine' : ''} style={{ width: `${(h.plan.strength / maxF) * 50}%` }} />
            <i className={a.mio ? 'mine' : ''} style={{ width: `${(a.plan.strength / maxF) * 50}%` }} />
          </div>
          <span>{a.plan.strength.toFixed(1)}</span>
        </div>
        {nuestro && (
          <p className="small muted center">
            Moral del vestuario: {moraleLabel(s.club.morale).emoji} {moraleLabel(s.club.morale).text}
            {!s.club.staff.entrenador && ' · ⚠️ sin entrenador'}
          </p>
        )}

        <h4>Tácticas</h4>
        <div className="tactics">
          {[h, a].map((x) => (
            <div key={x.t.id} className={`tactic${x.mio ? ' mine' : ''}`}>
              <b>{x.plan.formation as Formation}</b>
              <span>{STYLES[x.estilo].icon} {STYLES[x.estilo].label}</span>
            </div>
          ))}
        </div>

        <h4>Alineaciones</h4>
        <div className="lineups">
          <div>
            <div className="lineup-title">{h.t.short}</div>
            <Pitch xi={h.plan.xi} />
          </div>
          <div>
            <div className="lineup-title">{a.t.short}</div>
            <Pitch xi={a.plan.xi} />
          </div>
        </div>
        {[h, a].some((x) => x.bajas.length) && (
          <p className="small muted">
            🤕 Bajas:{' '}
            {[h, a]
              .flatMap((x) => x.bajas.map((p) => `${p.name} (${x.t.short}, ${p.injury} j.)`))
              .join(', ')}
          </p>
        )}

        <div className="overlay-actions">
          <button className="btn primary big full" onClick={onPlay}>▶ Jugar en directo</button>
          <button className="btn full" onClick={onSkip}>⏩ Ver solo el resultado</button>
        </div>
      </div>
    </div>
  );
}
