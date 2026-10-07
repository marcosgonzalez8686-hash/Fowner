import { useState } from 'react';
import type { Update } from '../App';
import type { GameState, Message } from '../game/types';
import { Sheet } from '../ui';

const FROM_ICON: Record<Message['from'], string> = { director: '💼', club: '🏛️', liga: '🏆', prensa: '📰' };

/** Bandeja de mensajes, se abre desde la cabecera */
export default function Bandeja({ s, update, onClose }: { s: GameState; update: Update; onClose: () => void }) {
  const [abierto, setAbierto] = useState<number | null>(null);
  const mensajes = s.messages.filter((m) => m.status !== 'pendiente').slice(0, 60);
  const sinLeer = mensajes.filter((m) => !m.read).length;

  return (
    <Sheet title="📬 Bandeja" onClose={onClose}>
      {sinLeer > 0 && (
        <button
          className="link small"
          onClick={() => update((g) => g.messages.forEach((m) => { if (m.status !== 'pendiente') m.read = true; }))}
        >
          Marcar todo como leído ({sinLeer})
        </button>
      )}
      {mensajes.length === 0 && <p className="muted">Sin mensajes.</p>}
      {mensajes.map((m) => (
        <div key={m.id} className={`msg${m.read ? '' : ' unread'}`}>
          <button
            className="msg-title as-btn"
            onClick={() => {
              setAbierto(abierto === m.id ? null : m.id);
              if (!m.read) update((g) => { g.messages.find((x) => x.id === m.id)!.read = true; });
            }}
          >
            <span>{FROM_ICON[m.from]} {m.title}</span>
            <span className="muted small">
              {m.status && m.status !== 'pendiente' ? `${m.status} · ` : ''}T{m.season} J{m.matchday}
            </span>
          </button>
          {abierto === m.id && <p className="pre">{m.body}</p>}
        </div>
      ))}
    </Sheet>
  );
}

export const unreadCount = (s: GameState) => s.messages.filter((m) => !m.read && m.status !== 'pendiente').length;
