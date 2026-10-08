import { useState } from 'react';
import { teamById } from '../game/market';
import { CATS, CAT_KEYS, WINDOWS, type NatCat } from '../game/nations';
import type { GameState, Player } from '../game/types';
import { NATIONS, countryName, flagOf } from '../game/world';
import { PlayerLink, TeamLink } from '../nav/context';
import { Card, Ovr, Segmented } from '../ui';

/** Selecciones nacionales: última convocatoria de cada país y categoría, y palmarés de los torneos */
export default function Selecciones({ s }: { s: GameState }) {
  const [pais, setPais] = useState('ESP');
  const [cat, setCat] = useState<NatCat>('abs');
  const call = s.nations?.call;
  const ids = call?.squads[pais]?.[cat] ?? [];
  const jugadores = ids.map((id) => s.players.find((p) => p.id === id)).filter(Boolean) as Player[];
  const nuestros = new Set(s.players.filter((p) => p.teamId === s.club.teamId).map((p) => p.id));
  const historia = s.nations?.history ?? [];
  return (
    <>
      <div className="chips">
        {NATIONS.map((c) => (
          <button key={c} className={pais === c ? 'on' : ''} onClick={() => setPais(c)}>{flagOf(c)} {countryName(c)}</button>
        ))}
      </div>
      <Segmented value={cat} onChange={(v) => setCat(v as NatCat)} options={CAT_KEYS.map((k) => ({ value: k, label: CATS[k].name }))} />
      <Card title={`${flagOf(pais)} ${countryName(pais)} · ${CATS[cat].name}`}>
        {!call ? (
          <p className="small muted">Aún no ha habido convocatoria. Los parones de selecciones son tras las jornadas {WINDOWS.join(', ')}.</p>
        ) : (
          <>
            <p className="small muted">Última convocatoria: temporada {call.season}, jornada {call.matchday}. Próximos parones tras las jornadas {WINDOWS.join(', ')}; en verano, torneos.</p>
            {jugadores.map((p) => (
              <div key={p.id} className={`player${nuestros.has(p.id) ? ' me-row' : ''}`}>
                <span className="pos">{p.pos}</span>
                <span className="name">
                  <PlayerLink id={p.id}>{p.name}</PlayerLink>
                  <small>
                    {p.age} años · {p.teamId === null ? 'libre' : <TeamLink id={p.teamId === s.club.teamId ? undefined : p.teamId}>{teamById(s, p.teamId)?.name}</TeamLink>}
                    {' · '}{p.caps?.[cat] ?? 0} partidos
                    {nuestros.has(p.id) && <b> · ★ nuestro</b>}
                  </small>
                </span>
                <Ovr v={p.ovr} />
              </div>
            ))}
            {!jugadores.length && <p className="small muted">No hay jugadores convocables en esta categoría.</p>}
          </>
        )}
      </Card>
      <Card title="🏆 Palmarés de selecciones">
        {historia.length === 0 ? (
          <p className="small muted">Cada verano: Mundial (temporadas pares) o Eurocopa (impares), Europeo Sub-21 y Europeo Sub-19.</p>
        ) : (
          <ul className="satlog">
            {historia.map((h, i) => (
              <li key={i}>T{h.season} · {h.name}: <b>{flagOf(h.champion)} {countryName(h.champion)}</b> (final contra {flagOf(h.runnerUp)} {countryName(h.runnerUp)})</li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
