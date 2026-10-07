import { useState } from 'react';
import { fmtMoney } from '../game/economy';
import { deleteGame, listSlots, type Slot } from '../game/save';

interface Props {
  onLoad: (slot: Slot) => void;
  onNew: (slot: Slot, nombre: string) => void;
}

function fecha(ms: number) {
  return new Date(ms).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function Start({ onLoad, onNew }: Props) {
  const [slots, setSlots] = useState(listSlots);
  const [creando, setCreando] = useState<Slot | null>(null);
  const [nombre, setNombre] = useState('CD Fowner');

  const borrar = (slot: Slot, club: string) => {
    if (!confirm(`¿Borrar la partida del ${club}? No se puede deshacer.`)) return;
    deleteGame(slot);
    setSlots(listSlots());
  };

  if (creando) {
    return (
      <div className="start">
        <img src="./icon.svg" alt="" className="logo" />
        <h1>Nueva partida</h1>
        <p className="lead">
          Acabas de comprar un club humilde de la Liga Comarcal. Cinco divisiones por delante y una caja muy justa.
        </p>
        <ul className="pitch">
          <li>🏟️ Tú eres el dueño: estadio, entradas, instalaciones y dinero.</li>
          <li>💼 Contrata un director deportivo y elige qué le delegas.</li>
          <li>✅ Para cada tarea: lo haces tú, te lo propone o lo hace solo.</li>
        </ul>
        <label className="field">
          <span>Nombre del club</span>
          <input value={nombre} maxLength={28} onChange={(e) => setNombre(e.target.value)} autoFocus />
        </label>
        <button className="btn primary big" onClick={() => onNew(creando, nombre)}>
          Comprar el club
        </button>
        <button className="btn" onClick={() => setCreando(null)}>
          Volver
        </button>
      </div>
    );
  }

  return (
    <div className="start">
      <img src="./icon.svg" alt="" className="logo" />
      <h1>Fowner</h1>
      <p className="lead">Eres el dueño del club. Tú decides cuánto delegas.</p>

      {slots.map(({ slot, meta }) =>
        meta ? (
          <div key={slot} className="slot">
            <button className="slot-main as-btn" onClick={() => onLoad(slot)}>
              <span className="slot-num">{slot}</span>
              <span className="slot-info">
                <b>{meta.club}</b>
                <small>
                  {meta.gameOver
                    ? 'Club en quiebra'
                    : `${meta.division} · T${meta.season} · ${meta.phase === 'pretemporada' ? 'Pretemporada' : `J${meta.matchday}/38`}`}
                </small>
                <small>
                  Caja {fmtMoney(meta.cash)} · guardada {fecha(meta.savedAt)}
                </small>
              </span>
              <span className="slot-go">Cargar ›</span>
            </button>
            <button className="icon-btn" onClick={() => borrar(slot, meta.club)} aria-label={`Borrar partida ${slot}`}>
              🗑️
            </button>
          </div>
        ) : (
          <button
            key={slot}
            className="slot empty as-btn"
            onClick={() => {
              setNombre('CD Fowner');
              setCreando(slot);
            }}
          >
            <span className="slot-num">{slot}</span>
            <span className="slot-info">
              <b>Hueco libre</b>
              <small>Toca para empezar una partida nueva</small>
            </span>
            <span className="slot-go">＋</span>
          </button>
        ),
      )}

      {slots.every((x) => x.meta) && (
        <p className="small muted center">Tienes los 3 huecos ocupados. Borra una partida para empezar otra.</p>
      )}
    </div>
  );
}
