import { useState } from 'react';
import type { ScreenProps } from '../App';
import Crest from '../components/Crest';
import { CrestEditor, KitsEditor } from '../components/Editors';
import KitView from '../components/KitView';
import type { Identity } from '../game/identity';
import { Card, Sheet } from '../ui';

type Edicion = 'escudo' | 'equipaciones' | 'datos' | null;

/** Tarjeta de identidad del club con edición posterior */
export default function Identidad({ s, update, notify }: ScreenProps) {
  const id = s.club.identity;
  const [editando, setEditando] = useState<Edicion>(null);
  const [borrador, setBorrador] = useState<Identity>(id);

  const abrir = (e: Edicion) => {
    setBorrador(id);
    setEditando(e);
  };
  const guardar = () => {
    if (!borrador.stadium.trim() || !borrador.ownerName.trim() || !borrador.ownerSurname.trim()) {
      notify('Rellena todos los campos');
      return;
    }
    update((g) => {
      g.club.identity = { ...borrador, stadium: borrador.stadium.trim(), ownerName: borrador.ownerName.trim(), ownerSurname: borrador.ownerSurname.trim() };
    });
    setEditando(null);
    notify('Cambios guardados');
  };

  return (
    <Card title="🛡️ Identidad del club">
      <div className="identity">
        <button className="as-btn plain" onClick={() => abrir('escudo')} aria-label="Editar escudo">
          <Crest c={id.crest} size={64} />
        </button>
        <div className="identity-info">
          <div>🏟️ <b>{id.stadium}</b></div>
          <div className="small muted">Presidente: {id.ownerName} {id.ownerSurname}</div>
          <button className="link small" onClick={() => abrir('datos')}>Cambiar nombres</button>
        </div>
        <button className="as-btn plain kits-mini" onClick={() => abrir('equipaciones')} aria-label="Editar equipaciones">
          <KitView k={id.home} size={30} />
          <KitView k={id.away} size={30} />
        </button>
      </div>
      <div className="row">
        <button className="btn small grow" onClick={() => abrir('escudo')}>Editar escudo</button>
        <button className="btn small grow" onClick={() => abrir('equipaciones')}>Editar equipaciones</button>
      </div>

      {editando && (
        <Sheet
          title={editando === 'escudo' ? 'Escudo' : editando === 'equipaciones' ? 'Equipaciones' : 'Nombres'}
          onClose={() => setEditando(null)}
        >
          {editando === 'escudo' && <CrestEditor value={borrador.crest} onChange={(crest) => setBorrador({ ...borrador, crest })} />}
          {editando === 'equipaciones' && (
            <KitsEditor home={borrador.home} away={borrador.away} onChange={(home, away) => setBorrador({ ...borrador, home, away })} />
          )}
          {editando === 'datos' && (
            <div className="editor">
              <label className="field">
                <span>Nombre del estadio</span>
                <input value={borrador.stadium} maxLength={36} onChange={(e) => setBorrador({ ...borrador, stadium: e.target.value })} />
              </label>
              <label className="field">
                <span>Tu nombre</span>
                <input value={borrador.ownerName} maxLength={30} onChange={(e) => setBorrador({ ...borrador, ownerName: e.target.value })} />
              </label>
              <label className="field">
                <span>Tus apellidos</span>
                <input value={borrador.ownerSurname} maxLength={40} onChange={(e) => setBorrador({ ...borrador, ownerSurname: e.target.value })} />
              </label>
            </div>
          )}
          <button className="btn primary full" onClick={guardar}>Guardar</button>
        </Sheet>
      )}
    </Card>
  );
}
