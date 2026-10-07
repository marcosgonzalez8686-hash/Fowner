import { useMemo, useState } from 'react';
import type { ScreenProps } from '../App';
import { levelOf } from '../game/director';
import { DIV_LEVEL, fmtMoney } from '../game/economy';
import { askingPrice, askingSalary, buyPlayer, marketOpen, myTeam, teamById, willJoin } from '../game/market';
import type { Player, Pos } from '../game/types';
import { Card, Ovr, Segmented, Sheet } from '../ui';
import OffersCard from '../components/OffersCard';
import { PlayerTags, ProfileDetail } from '../components/Traits';
import { requestReport, shownPot } from '../game/scouting';
import { MAX_LOANS_IN, loanAnswer, loanFee, loanIn } from '../game/loans';

type Filtro = 'TODOS' | Pos;

export default function Mercado({ s, update, notify }: ScreenProps) {
  const [pos, setPos] = useState<Filtro>('TODOS');
  const [soloAsequibles, setSoloAsequibles] = useState(true);
  const [libres, setLibres] = useState(false);
  const [sel, setSel] = useState<Player | null>(null);
  const [anos, setAnos] = useState('2');
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
      <OffersCard s={s} update={update} notify={notify} />
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
          <button key={p.id} className="player as-btn" onClick={() => { setSel(p); setAnos(p.age <= 24 ? '3' : '2'); }}>
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

      {sel && (
        <Sheet title={sel.name} onClose={() => setSel(null)}>
          <p className="muted">
            {sel.pos} · {sel.age} años · media {sel.ovr} · potencial {shownPot(s, sel)}
            <br />
            {sel.teamId === null ? 'Agente libre' : teamById(s, sel.teamId)!.name}
          </p>
          <ProfileDetail s={s} p={sel} fichaje onReport={() => notify(update((g) => requestReport(g, sel.id)) ?? '')} />
          <div className="kpis">
            <div><b>{fmtMoney(askingPrice(sel))}</b><span>traspaso</span></div>
            <div><b>{fmtMoney(askingSalary(s, sel))}</b><span>ficha/temp.</span></div>
          </div>
          <h4>Duración del contrato</h4>
          <Segmented
            value={anos}
            onChange={setAnos}
            options={['1', '2', '3', '4'].map((v) => ({ value: v, label: `${v} año${v === '1' ? '' : 's'}` }))}
          />
          <button
            className="btn primary full"
            onClick={() => {
              const err = update((g) => buyPlayer(g, sel.id, askingPrice(sel), askingSalary(s, sel), Number(anos)).error);
              notify(err ?? `¡${sel.name} es nuevo jugador del club!`);
              setSel(null);
            }}
          >
            Fichar
          </button>
          {sel.teamId !== null && (() => {
            const r = loanAnswer(s, sel);
            return (
              <>
                <h4>Cesión</h4>
                {r.ok ? (
                  <>
                    <p className="small muted">Hasta final de temporada. Cuota {fmtMoney(loanFee(sel))} y pagas su ficha ({fmtMoney(sel.salary)}). Máximo {MAX_LOANS_IN} cedidos.</p>
                    <button
                      className="btn full"
                      onClick={() => {
                        notify(update((g) => loanIn(g, sel.id)) ?? '');
                        setSel(null);
                      }}
                    >
                      🔁 Pedir cedido
                    </button>
                  </>
                ) : (
                  <p className="small muted">{r.reason}</p>
                )}
              </>
            );
          })()}
        </Sheet>
      )}
    </>
  );
}
