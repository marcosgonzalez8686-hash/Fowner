import type { ScreenProps } from '../App';
import { setTicketPrice } from '../game/club';
import { DIV_PRICE, fmtMoney } from '../game/economy';
import { myTeam } from '../game/market';
import {
  HOME_GAMES, MAX_SHARE, leagueAttendance, seasonPriceRatio, seasonTicketForecast, setSeasonTickets, suggestedSeasonPrice,
} from '../game/tickets';
import { Card, Stepper } from '../ui';

export default function Entradas({ s, update, go }: ScreenProps) {
  const t = myTeam(s);
  const c = s.club;
  const st = c.seasonTickets;
  const pre = s.phase === 'pretemporada';
  const abonos = pre ? seasonTicketForecast(s) : st.sold;
  const asis = leagueAttendance(s);
  const cap = c.capacity;
  const pctAbo = Math.min(100, (asis.abonados / cap) * 100);
  const pctEnt = Math.min(100 - pctAbo, (asis.entradas / cap) * 100);
  const reservadosVacios = Math.max(0, Math.min(abonos, cap) - asis.abonados);
  const lleno = abonos + asis.entradas >= cap;
  const ratio = seasonPriceRatio(s);
  const paso = Math.max(5, Math.round(suggestedSeasonPrice(s) / 20 / 5) * 5);

  return (
    <>
      <Card title="🎫 Abono de temporada">
        {pre ? (
          <>
            <p className="small muted">
              Se venden al empezar la liga y se cobran de una vez. Los abonados <b>no pagan entrada</b> en los
              {` ${HOME_GAMES} `}partidos de liga en casa (la Copa no entra en el abono). Sus asientos quedan reservados.
            </p>
            <h4>Precio del abono</h4>
            <Stepper
              value={st.price}
              step={paso}
              min={10}
              format={fmtMoney}
              onChange={(v) => update((g) => setSeasonTickets(g, v, g.club.seasonTickets.maxShare))}
            />
            <p className="small muted center">
              Equivale a {Math.round(ratio * 100)}% de comprar las {HOME_GAMES} entradas sueltas
              ({fmtMoney(c.ticketPrice * HOME_GAMES)}). Recomendado: {fmtMoney(suggestedSeasonPrice(s))}.
            </p>
            <h4>Máximo de asientos para abonados</h4>
            <Stepper
              value={Math.round(st.maxShare * 100)}
              step={5}
              min={0}
              format={(v) => `${Math.min(v, MAX_SHARE * 100)}% del aforo`}
              onChange={(v) => update((g) => setSeasonTickets(g, g.club.seasonTickets.price, Math.min(v, MAX_SHARE * 100) / 100))}
            />
            <div className="kpis">
              <div><b>{abonos.toLocaleString('es-ES')}</b><span>abonos previstos</span></div>
              <div><b>{fmtMoney(abonos * st.price)}</b><span>ingreso de la campaña</span></div>
            </div>
            {ratio > 0.9 && <p className="hint warn-bg">Abono caro: venderás pocos y a la afición no le gustará.</p>}
            {ratio < 0.5 && <p className="hint">Abono muy barato: se venderá mucho, pero dejarás de ingresar en taquilla.</p>}
          </>
        ) : (
          <>
            <div className="kpis">
              <div><b>{st.sold.toLocaleString('es-ES')}</b><span>abonados esta temporada</span></div>
              <div><b>{fmtMoney(c.ledger.abonos)}</b><span>ingresado por abonos</span></div>
            </div>
            <p className="small muted">
              Precio: {fmtMoney(st.price)}. La campaña se cerró al empezar la liga; podrás cambiarla en la próxima pretemporada.
            </p>
          </>
        )}
      </Card>

      <Card title="🎟️ Entrada de partido">
        <Stepper value={c.ticketPrice} step={1} min={1} format={(v) => `${v} €`} onChange={(v) => update((g) => setTicketPrice(g, v))} />
        <p className="small muted center">Precio de referencia en esta categoría: {DIV_PRICE[t.division]} €.</p>

        <h4>Próximo partido de liga en casa{pre ? ' (previsión)' : ''}</h4>
        <div className="meter stack" aria-label="Ocupación del estadio">
          <i className="s1" style={{ width: `${pctAbo}%` }} />
          <i className="s2" style={{ width: `${pctEnt}%` }} />
        </div>
        <div className="legend-row">
          <span><i className="sw s1" /> Abonados que van: {asis.abonados.toLocaleString('es-ES')}</span>
          <span><i className="sw s2" /> Entradas vendidas: {asis.entradas.toLocaleString('es-ES')}</span>
        </div>
        <div className="kpis">
          <div><b>{asis.total.toLocaleString('es-ES')}</b><span>espectadores de {cap.toLocaleString('es-ES')}</span></div>
          <div><b>{fmtMoney(asis.entradas * c.ticketPrice)}</b><span>taquilla (solo entradas)</span></div>
        </div>
        {reservadosVacios > 0 && (
          <p className="small muted">{reservadosVacios.toLocaleString('es-ES')} asientos de abonados que no vienen se quedan vacíos.</p>
        )}
        <p className="small muted">
          {lleno
            ? 'No quedan entradas a la venta: podrías subir el precio o ampliar el aforo.'
            : 'Quedan asientos libres: bajar el precio o ganar partidos atrae más público.'}
        </p>
        {lleno && (
          <button className="btn full" onClick={() => go('instalaciones')}>Ampliar el estadio ›</button>
        )}
        <p className="small muted">En Copa no vale el abono: paga todo el que va.</p>
      </Card>
    </>
  );
}
