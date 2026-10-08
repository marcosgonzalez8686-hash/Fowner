import { DIVISION_NAMES, DIV_LEVEL } from '../game/economy';
import { rivalCrest } from '../game/identity';
import { myTeam, squadOf, teamById } from '../game/market';
import { bestEleven, computeStandings, form, STYLES } from '../game/match';
import { flagOf, leagueName } from '../game/world';
import type { GameState, Pos } from '../game/types';
import { Ovr, Sheet } from '../ui';
import Crest from './Crest';
import { PlayerTags } from './Traits';
import { useNav } from '../nav/context';
import { facilitiesOf } from '../game/rivals';
import { BUILDINGS, buildingLevel, type BuildingKind } from '../game/land';

const LINEAS: { pos: Pos; name: string }[] = [
  { pos: 'POR', name: 'Porteros' },
  { pos: 'DEF', name: 'Defensas' },
  { pos: 'MED', name: 'Centrocampistas' },
  { pos: 'DEL', name: 'Delanteros' },
];

/** Ficha de un equipo rival: clasificación, sistema y plantilla */
export default function TeamSheet({ s, id, onClose }: { s: GameState; id: number; onClose: () => void }) {
  const { openPlayer } = useNav();
  const t = teamById(s, id);
  if (!t) {
    return (
      <Sheet title="Equipo" onClose={onClose} top>
        <p className="muted">Equipo no encontrado.</p>
      </Sheet>
    );
  }
  const squad = squadOf(s, id).filter((p) => !p.youth);
  const plan = bestEleven(squad);
  const titulares = new Set(plan.xi.map((p) => p.id));
  const nuestro = bestEleven(squadOf(s, s.club.teamId)).strength;
  const liga = t.country
    ? null
    : (() => {
        const tabla = computeStandings(s.teams.filter((x) => x.division === t.division).map((x) => x.id), s.fixtures[t.division]);
        const i = tabla.findIndex((r) => r.teamId === id);
        return { pos: i + 1, row: tabla[i] };
      })();
  const racha = t.country ? [] : form(id, s.fixtures[t.division]);
  const nivel = DIV_LEVEL[myTeam(s).division];

  return (
    <Sheet title={t.name} onClose={onClose} top>
      <div className="club-hero">
        <Crest c={rivalCrest(t.id, t.short)} size={52} />
        <div>
          <b>{t.name}</b>
          <div className="small muted">
            {t.country ? `${flagOf(t.country)} ${leagueName(t.country)}` : DIVISION_NAMES[t.division]} · {t.fans.toLocaleString('es-ES')} aficionados
          </div>
          {liga?.row && (
            <div className="small">
              {liga.row.pj ? `${liga.pos}º` : '—'} · {liga.row.pts} pts · {liga.row.g}-{liga.row.e}-{liga.row.p}
              {racha.length > 0 && ` · racha ${racha.join(' ')}`}
            </div>
          )}
        </div>
      </div>
      <div className="kpis">
        <div><b>{plan.strength.toFixed(1)}</b><span>media del once</span></div>
        <div><b>{plan.formation}</b><span>su sistema</span></div>
        <div><b className={plan.strength > nuestro ? 'neg' : 'pos'}>{plan.strength > nuestro ? '+' : ''}{(plan.strength - nuestro).toFixed(1)}</b><span>respecto a nuestro once</span></div>
        <div><b>{squad.length}</b><span>jugadores</span></div>
      </div>
      {(() => {
        const f = facilitiesOf(t);
        const kinds = Object.keys(BUILDINGS) as BuildingKind[];
        return (
          <>
            <h4>Instalaciones</h4>
            <p className="small">
              🏟️ <b>{f.stadium}</b> · {f.capacity.toLocaleString('es-ES')} espectadores
              {!t.country && <span className="muted"> (el nuestro: {s.club.capacity.toLocaleString('es-ES')})</span>}
            </p>
            <p className="small muted">Influyen en cómo crecen sus jóvenes y en lo que aprietan en su campo.</p>
            <div className="fac-grid">
              {kinds.map((k) => {
                const suyo = f.levels[k] ?? 0;
                const mio = buildingLevel(s, k);
                return (
                  <div key={k} className={`fac${suyo ? '' : ' none'}`}>
                    <span aria-hidden>{BUILDINGS[k].icon}</span>
                    <span className="fac-name">{BUILDINGS[k].name}</span>
                    <b>{suyo ? `${suyo}/${BUILDINGS[k].maxLevel}` : '—'}</b>
                    {!t.country && <small className={mio > suyo ? 'pos' : mio < suyo ? 'neg' : 'muted'}>tú {mio || '—'}</small>}
                  </div>
                );
              })}
            </div>
          </>
        );
      })()}
      <p className="small muted">Su entrenador elige el estilo según el rival (de {STYLES.defensivo.label.toLowerCase()} a {STYLES.ofensivo.label.toLowerCase()}). ⭐ titular. Toca un jugador para ver su ficha.</p>
      {LINEAS.map(({ pos, name }) => {
        const deEsa = squad.filter((p) => p.pos === pos).sort((a, b) => b.ovr - a.ovr);
        if (!deEsa.length) return null;
        return (
          <div key={pos}>
            <h4>{name}</h4>
            {deEsa.map((p) => (
              <button key={p.id} className="player as-btn" onClick={() => openPlayer(p.id)}>
                <span className="pos">{titulares.has(p.id) ? '⭐' : ''}</span>
                <span className="name">
                  {p.name}
                  <small>{p.age} años{p.loan ? ' · cedido' : ''}{(p.injury ?? 0) > 0 ? ` · 🤕 ${p.injury} j.` : ''}</small>
                  <PlayerTags s={s} p={p} />
                </span>
                <Ovr v={p.ovr} base={nivel} />
              </button>
            ))}
          </div>
        );
      })}
    </Sheet>
  );
}
