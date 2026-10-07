import { useState } from 'react';
import type { Update } from '../App';
import { fmtMoney } from '../game/economy';
import {
  SLOTS, SLOT_ORDER, signOffer, slotStatus, sponsorFixed, sponsorPerWin, type SponsorSlot,
} from '../game/sponsor';
import type { GameState } from '../game/types';
import { Card, Stars } from '../ui';

const anos = (n: number) => `${n} temporada${n === 1 ? '' : 's'}`;

/** Las tres ofertas de un espacio, para firmar una */
export function SlotOffers({ s, slot, update, notify }: { s: GameState; slot: SponsorSlot; update: Update; notify: (m: string) => void }) {
  const ofertas = s.sponsorOffers[slot] ?? [];
  return (
    <div className="offers">
      {ofertas.map((o) => (
        <div key={o.id} className="offer">
          <div className="offer-head">
            <b>{o.name}</b>
            <span className="tag">{anos(o.years)}</span>
          </div>
          <div className="small muted">{o.sector}</div>
          <ul className="offer-terms">
            <li><b>{fmtMoney(o.annual)}</b> al año</li>
            {o.perWin ? <li>+{fmtMoney(o.perWin)} por cada victoria</li> : null}
            <li>Total garantizado: {fmtMoney(o.annual * o.years)}</li>
          </ul>
          <button
            className="btn primary full"
            onClick={() => {
              const err = update((g) => signOffer(g, slot, o.id));
              notify(err ?? `Firmado con ${o.name}`);
            }}
          >
            Firmar
          </button>
        </div>
      ))}
    </div>
  );
}

/** Apartado de patrocinadores de Finanzas */
export default function Sponsors({ s, update, notify }: { s: GameState; update: Update; notify: (m: string) => void }) {
  const [abierto, setAbierto] = useState<SponsorSlot | null>(() => SLOT_ORDER.find((k) => s.sponsorOffers[k]?.length) ?? null);
  const activos = SLOT_ORDER.filter((k) => s.club.sponsors[k]).length;
  const disponibles = SLOT_ORDER.filter((k) => slotStatus(s, k).available).length;
  const perWin = sponsorPerWin(s);

  return (
    <Card title="🤝 Patrocinadores" right={<span className="small muted">{activos} de {disponibles} espacios</span>}>
      <div className="kpis">
        <div><b>{fmtMoney(sponsorFixed(s))}</b><span>al año en contratos</span></div>
        <div><b>{perWin ? `+${fmtMoney(perWin)}` : '—'}</b><span>prima por victoria</span></div>
      </div>
      <p className="small muted">
        Cada instalación que construyes abre un espacio nuevo para patrocinar, y cuanto mejor es (nivel, aforo, afición),
        mejores son las ofertas.
      </p>

      {SLOT_ORDER.map((slot) => {
        const info = SLOTS[slot];
        const st = slotStatus(s, slot);
        const c = s.club.sponsors[slot];
        const ofertas = s.sponsorOffers[slot] ?? [];
        if (!st.available) {
          return (
            <div key={slot} className="sp-row locked">
              <span className="sp-ico">{info.icon}</span>
              <span className="sp-main">
                <b>{info.name}</b>
                <small>🔒 {st.reason}</small>
              </span>
            </div>
          );
        }
        return (
          <div key={slot} className="sp-block">
            <button className="sp-row as-btn" onClick={() => setAbierto(abierto === slot ? null : slot)} disabled={!c && !ofertas.length}>
              <span className="sp-ico">{info.icon}</span>
              <span className="sp-main">
                <b>{info.name}</b>
                {c ? (
                  <small>
                    {c.name} · {fmtMoney(c.annual)}/año · {c.yearsLeft === 1 ? 'última temporada' : `quedan ${c.yearsLeft} temporadas`}
                  </small>
                ) : (
                  <small className="warn">Libre · {ofertas.length} ofertas para elegir</small>
                )}
              </span>
              <span className="sp-stars" title="Calidad del espacio"><Stars n={Math.round(st.level)} /></span>
            </button>
            {abierto === slot && !c && ofertas.length > 0 && <SlotOffers s={s} slot={slot} update={update} notify={notify} />}
            {abierto === slot && c && (
              <p className="small muted sp-detail">
                Contrato de {anos(c.years)} con {c.name} ({c.sector}). Al terminar llegarán tres ofertas nuevas.
                {c.perWin ? ` Incluye ${fmtMoney(c.perWin)} por victoria.` : ''}
              </p>
            )}
          </div>
        );
      })}
    </Card>
  );
}
