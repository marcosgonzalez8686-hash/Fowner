import { useState } from 'react';
import { competitions, honoursRanking } from '../game/honours';
import type { GameState } from '../game/types';
import { countryName, flagOf } from '../game/world';
import { TeamLink } from '../nav/context';
import { Segmented, Sheet } from '../ui';

type Vista = 'ranking' | 'comp' | 'selecciones';

/** Palmarés mundial: clubes con más títulos, campeones de cada competición y selecciones */
export default function Palmares({ s, onClose }: { s: GameState; onClose: () => void }) {
  const [vista, setVista] = useState<Vista>('ranking');
  const comps = competitions(s);
  const [comp, setComp] = useState(comps[1]?.key ?? 'liga0');
  const mio = s.club.teamId;
  const ranking = honoursRanking(s);
  const nuestro = ranking.findIndex((c) => c.teamId === mio);
  const lista = (s.honours ?? []).filter((h) => h.comp === comp).sort((a, b) => b.season - a.season);
  const selecciones = s.nations?.history ?? [];

  return (
    <Sheet title="🌍 Palmarés mundial" onClose={onClose}>
      <Segmented
        value={vista}
        onChange={setVista}
        options={[
          { value: 'ranking', label: '🏆 Clubes' },
          { value: 'comp', label: '📜 Campeones' },
          { value: 'selecciones', label: '🌍 Selecciones' },
        ]}
      />

      {vista === 'ranking' &&
        (ranking.length === 0 ? (
          <p className="muted small">Todavía no se ha repartido ningún título. Al acabar cada competición, su campeón aparecerá aquí.</p>
        ) : (
          <>
            <p className="small muted">
              Ordenados por la importancia de sus títulos: la Champions y las primeras divisiones pesan más que una Supercopa o una liga de categoría baja.
              {nuestro >= 0 ? ` Tu club es ${nuestro + 1}º.` : ''}
            </p>
            <ol className="honours">
              {ranking.slice(0, 40).map((c, i) => (
                <li key={c.teamId} className={c.teamId === mio ? 'me' : ''}>
                  <span className="hon-pos">{i + 1}</span>
                  <span className="hon-main">
                    <span>
                      {c.country ? `${flagOf(c.country)} ` : ''}<TeamLink id={c.teamId}>{c.name}</TeamLink>
                    </span>
                    <small>
                      {comps
                        .filter((k) => c.byComp[k.key])
                        .map((k) => `${k.icon}${c.byComp[k.key] > 1 ? `×${c.byComp[k.key]}` : ''}`)
                        .join(' ')}
                    </small>
                  </span>
                  <b>{c.total}</b>
                </li>
              ))}
            </ol>
          </>
        ))}

      {vista === 'comp' && (
        <>
          <label className="field">
            <span className="small muted">Competición</span>
            <select value={comp} onChange={(e) => setComp(e.target.value)}>
              {comps.map((c) => (
                <option key={c.key} value={c.key}>{c.icon} {c.name}</option>
              ))}
            </select>
          </label>
          {lista.length === 0 ? (
            <p className="muted small">Aún no hay campeón de esta competición.</p>
          ) : (
            <table className="table">
              <thead>
                <tr><th className="left">Temp.</th><th className="left">Campeón</th><th className="left">Subcampeón</th></tr>
              </thead>
              <tbody>
                {lista.map((h) => (
                  <tr key={h.season} className={h.teamId === mio || h.runnerUp?.teamId === mio ? 'me' : ''}>
                    <td className="left">T{h.season}</td>
                    <td className="left"><b><TeamLink id={h.teamId}>{h.name}</TeamLink></b></td>
                    <td className="left">{h.runnerUp ? <TeamLink id={h.runnerUp.teamId}>{h.runnerUp.name}</TeamLink> : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}

      {vista === 'selecciones' &&
        (selecciones.length === 0 ? (
          <p className="muted small">Los torneos de selecciones se juegan en verano: el Mundial o la Eurocopa, y los europeos sub-21 y sub-19.</p>
        ) : (
          <table className="table">
            <thead>
              <tr><th className="left">Temp.</th><th className="left">Torneo</th><th className="left">Campeón</th><th className="left">Final</th></tr>
            </thead>
            <tbody>
              {selecciones.map((h, i) => (
                <tr key={i}>
                  <td className="left">T{h.season}</td>
                  <td className="left">{h.name}</td>
                  <td className="left"><b>{flagOf(h.champion)} {countryName(h.champion)}</b></td>
                  <td className="left">{flagOf(h.runnerUp)} {countryName(h.runnerUp)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ))}
    </Sheet>
  );
}
