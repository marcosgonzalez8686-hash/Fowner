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

type Filtro = 'TODOS' | Pos;

export default function Mercado({ s, update, notify }: ScreenProps) {
  const [pos, setPos] = useState<Filtro>('TODOS');
  const [soloAsequibles, setSoloAsequibles] = useState(true);
  const [libres, setLibres] = useState(false);
  const { openPlayer } = useNav();
  const nivel = DIV_LEVEL[myTeam(s).division];

  const lista = useMemo(() => {
    return s.players
      .filter((p) => p.teamId !== s.club.teamId && !p.youth && !p.loan)
      .filter((p) => pos === 'TODOS' || p.pos === pos)
      .filter((p) => !libres || p.teamId === null)
      .filter((p) => willJoin(s, p))
      .filter((p) => !soloAsequibles || askingPrice(p) <= s.club.cash)
      .sort((a, b) => b.ovr - a.ovr)
      .slice(0, 40);
  }, [s, pos, soloAsequibles, libres]);

  if (!marketOpen(s)) {
    return (
      <Card title="Mercado cerrado">
        <p className="muted">
          El mercado abre en pretemporada y en el parón de invierno (jornadas 19 a 21).
        </p>
      </Card>
    );
  }

  return (
    <>
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
      <Card>
        {lista.length === 0 && <p className="muted">No hay jugadores con estos filtros.</p>}
        {lista.map((p) => (
          <button key={p.id} className="player as-btn" onClick={() => openPlayer(p.id)}>
            <span className="pos">{p.pos}</span>
            <span className="name">
              {p.name}
              <small>
                {p.age} años · {p.teamId === null ? 'libre' : teamById(s, p.teamId)!.name} · {fmtMoney(askingPrice(p))}
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
