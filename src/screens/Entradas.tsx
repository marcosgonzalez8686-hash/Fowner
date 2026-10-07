import type { ScreenProps } from '../App';
import { setTicketPrice } from '../game/club';
import { DIV_PRICE, fmtMoney } from '../game/economy';
import { myTeam } from '../game/market';
import { expectedAttendance } from '../game/season';
import { Card, Stepper } from '../ui';

export default function Entradas({ s, update, go }: ScreenProps) {
  const t = myTeam(s);
  const c = s.club;
  const ocupacion = expectedAttendance(s);
  const lleno = ocupacion >= c.capacity;
  return (
    <>
      <Card title="🎟️ Precio de la entrada">
        <Stepper value={c.ticketPrice} step={1} min={1} format={(v) => `${v} €`} onChange={(v) => update((g) => setTicketPrice(g, v))} />
        <p className="small muted center">Precio de referencia en esta categoría: {DIV_PRICE[t.division]} €.</p>
        <div className="kpis">
          <div><b>{ocupacion.toLocaleString('es-ES')}</b><span>espectadores esperados</span></div>
          <div><b>{fmtMoney(ocupacion * c.ticketPrice)}</b><span>taquilla por partido</span></div>
          <div><b>{c.capacity.toLocaleString('es-ES')}</b><span>aforo del estadio</span></div>
          <div><b>{t.fans.toLocaleString('es-ES')}</b><span>aficionados</span></div>
        </div>
        <div className="meter" aria-label={`Ocupación ${Math.round((ocupacion / c.capacity) * 100)}%`}>
          <i style={{ width: `${Math.min(100, (ocupacion / c.capacity) * 100)}%` }} />
        </div>
        <p className="small muted">
          {lleno
            ? 'El estadio se llena: podrías subir el precio o ampliar el aforo.'
            : 'Quedan asientos libres: bajar el precio o ganar partidos atrae más público.'}
        </p>
        {lleno && (
          <button className="btn full" onClick={() => go('instalaciones')}>Ampliar el estadio ›</button>
        )}
      </Card>
    </>
  );
}
