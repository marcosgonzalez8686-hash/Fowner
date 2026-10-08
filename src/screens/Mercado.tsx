import { useMemo, useState } from 'react';
import type { ScreenProps } from '../App';
import { levelOf } from '../game/director';
import { DIV_LEVEL, fmtMoney } from '../game/economy';
import { askingPrice, marketOpen, myTeam, teamById, willJoin } from '../game/market';
import type { Pos } from '../game/types';
import { Card, Ovr } from '../ui';
import NegotiationsCard from '../components/Negotiations';
import { PlayerTags } from '../components/Traits';
import { useNav } from '../nav/context';
import { countryName, flagOf } from '../game/world';

type Filtro = 'TODOS' | Pos;

export default function Mercado({ s, update, notify }: ScreenProps) {
  const [pos, setPos] = useState<Filtro>('TODOS');
  const [soloAsequibles, setSoloAsequibles] = useState(true);
  const [libres, setLibres] = useState(false);
  // 'TODAS', 'ESP' o el país de una liga extranjera
  const [liga, setLiga] = useState('TODAS');
  const { openPlayer } = useNav();
  const nivel = DIV_LEVEL[myTeam(s).division];

  const lista = useMemo(() => {
    return s.players
      .filter((p) => p.teamId !== s.club.teamId && !p.youth && !p.loan)
      .filter((p) => pos === 'TODOS' || p.pos === pos)
      .filter((p) => !libres || p.teamId === null)
      .filter((p) => {
        if (liga === 'TODAS' || p.teamId === null) return liga === 'TODAS' || libres;
        const c = teamById(s, p.teamId)?.country;
        return liga === 'ESP' ? !c : c === liga;
      })
      // en las ligas de fuera se ve a todos, aunque no vendrían todavía
      .filter((p) => willJoin(s, p) || (liga !== 'TODAS' && liga !== 'ESP'))
      .filter((p) => !soloAsequibles || askingPrice(s, p) <= s.club.cash)
      .sort((a, b) => b.ovr - a.ovr)
      .slice(0, 40);
  }, [s, pos, soloAsequibles, libres, liga]);

  return (
    <>
      {!marketOpen(s) && (
        <p className="hint">
          🔒 Mercado cerrado hasta {s.phase === 'temporada' && s.matchday < 18 ? 'la jornada 19' : 'la pretemporada'}. Puedes negociar igual: los acuerdos se harán efectivos (jugador y pago) al abrirse.
        </p>
      )}
      <NegotiationsCard s={s} update={update} notify={notify} />
      {levelOf(s, 'fichajes') !== 'manual' && (
        <p className="hint">💼 Tu director deportivo también está buscando fichajes. Puedes fichar tú igualmente.</p>
      )}
      <div className="chips">
        {(['TODOS', 'POR', 'DEF', 'MED', 'DEL'] as Filtro[]).map((f) => (
          <button key={f} className={pos === f ? 'on' : ''} onClick={() => setPos(f)}>{f === 'TODOS' ? 'Todos' : f}</button>
        ))}
      </div>
      <div className="chips">
        <button className={soloAsequibles ? 'on' : ''} onClick={() => setSoloAsequibles(!soloAsequibles)}>💰 Asequibles</button>
        <button className={libres ? 'on' : ''} onClick={() => setLibres(!libres)}>🆓 Solo libres</button>
      </div>
      <div className="chips">
        <button className={liga === 'TODAS' ? 'on' : ''} onClick={() => setLiga('TODAS')}>🌍 Todas las ligas</button>
        <button className={liga === 'ESP' ? 'on' : ''} onClick={() => setLiga('ESP')}>{flagOf('ESP')} España</button>
        {(s.world?.leagues ?? []).map((l) => (
          <button key={l.country} className={liga === l.country ? 'on' : ''} onClick={() => setLiga(l.country)}>{flagOf(l.country)} {countryName(l.country)}</button>
        ))}
      </div>
      <Card>
        {lista.length === 0 && <p className="muted">No hay jugadores con estos filtros.</p>}
        {lista.map((p) => (
          <button key={p.id} className="player as-btn" onClick={() => openPlayer(p.id)}>
            <span className="pos">{p.pos}</span>
            <span className="name">
              {p.nat && p.nat !== 'ESP' ? `${flagOf(p.nat)} ` : ''}{p.name}
              <small>
                {!willJoin(s, p) && <b className="warn">🚫 no vendría a tu categoría · </b>}
                {p.age} años · {p.teamId === null ? 'libre' : `${teamById(s, p.teamId)!.country ? `${flagOf(teamById(s, p.teamId)!.country)} ` : ''}${teamById(s, p.teamId)!.name}`} · {fmtMoney(askingPrice(s, p))}
              </small>
              <PlayerTags s={s} p={p} />
            </span>
            <Ovr v={p.ovr} base={nivel} />
          </button>
        ))}
      </Card>

    </>
  );
}
