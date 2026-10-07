import { useState } from 'react';
import Crest from '../components/Crest';
import type { Identity } from '../game/identity';
import NewGame from './NewGame';
import { fmtMoney } from '../game/economy';
import { deleteGame, listSlots, type Slot } from '../game/save';

interface Props {
  onLoad: (slot: Slot) => void;
  onNew: (slot: Slot, nombre: string, identity: Identity) => void;
}

function fecha(ms: number) {
  return new Date(ms).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function Start({ onLoad, onNew }: Props) {
  const [slots, setSlots] = useState(listSlots);
  const [creando, setCreando] = useState<Slot | null>(null);

  const borrar = (slot: Slot, club: string) => {
    if (!confirm(`¿Borrar la partida del ${club}? No se puede deshacer.`)) return;
    deleteGame(slot);
    setSlots(listSlots());
  };

  if (creando) {
    return <NewGame onCancel={() => setCreando(null)} onCreate={(nombre, identity) => onNew(creando, nombre, identity)} />;
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
              {meta.crest ? <span className="slot-crest"><Crest c={meta.crest} size={34} /></span> : <span className="slot-num">{slot}</span>}
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
            onClick={() => setCreando(slot)}
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
