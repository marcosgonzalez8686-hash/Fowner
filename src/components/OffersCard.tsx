import type { Update } from '../App';
import { levelOf } from '../game/director';
import { fmtMoney, playerValue } from '../game/economy';
import { teamById } from '../game/market';
import { acceptOffer, counterOffer, directorAdvice, rejectOffer } from '../game/offers';
import type { GameState } from '../game/types';
import { Card, Ovr } from '../ui';

const ICONO = { aceptar: '✅', pedir: '💬', rechazar: '❌' } as const;

/** Ofertas recibidas por nuestros jugadores, con negociación */
export default function OffersCard({ s, update, notify }: { s: GameState; update: Update; notify: (m: string) => void }) {
  if (!s.incomingOffers.length) return null;
  const conConsejo = Boolean(s.club.director) && levelOf(s, 'ventas') === 'propone';
  const responder = (fn: (g: GameState) => string) => {
    const msg = update((g) => fn(g));
    if (msg) notify(msg);
  };

  return (
    <Card title={`📨 Ofertas por tus jugadores (${s.incomingOffers.length})`}>
      <p className="small muted">
        Puedes aceptar, rechazar o pedir más. Si pides demasiado, pueden mejorar una vez… o retirarse.
      </p>
      {s.incomingOffers.map((o) => {
        const p = s.players.find((x) => x.id === o.playerId);
        const t = teamById(s, o.teamId);
        if (!p || !t) return null;
        const valor = playerValue(p);
        const consejo = conConsejo ? directorAdvice(s, o) : null;
        return (
          <div key={o.id} className="offer">
            <div className="offer-head">
              <b>{p.name}</b>
              <Ovr v={p.ovr} />
            </div>
            <div className="small muted">
              {p.pos} · {p.age} años · valor {fmtMoney(valor)} · cobra {fmtMoney(p.salary)}/temp.
            </div>
            <ul className="offer-terms">
              <li>
                <b>{t.name}</b> ({t.division + 1}ª) ofrece <b>{fmtMoney(o.fee)}</b> ({Math.round((o.fee / valor) * 100)}% de su valor)
                {o.rounds > 0 && ' · oferta mejorada'}
              </li>
              {o.wantsToLeave && <li>😏 Al jugador le seduce el salto: si rechazas, se molestará.</li>}
            </ul>
            {consejo && (
              <p className="hint small">
                💼 {ICONO[consejo.action]} {consejo.text}
              </p>
            )}
            <div className="row">
              <button className="btn primary grow" onClick={() => responder((g) => acceptOffer(g, o.id))}>Aceptar</button>
              <button className="btn grow" onClick={() => responder((g) => rejectOffer(g, o.id))}>Rechazar</button>
            </div>
            {o.rounds === 0 && (
              <div className="row">
                <button className="btn small grow" onClick={() => responder((g) => counterOffer(g, o.id, 0.15))}>
                  Pedir +15% ({fmtMoney(Math.round(o.fee * 1.15))})
                </button>
                <button className="btn small grow" onClick={() => responder((g) => counterOffer(g, o.id, 0.3))}>
                  Pedir +30% ({fmtMoney(Math.round(o.fee * 1.3))})
                </button>
              </div>
            )}
          </div>
        );
      })}
    </Card>
  );
}
