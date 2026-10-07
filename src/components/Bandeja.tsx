import { useState } from 'react';
import type { TabId, Update } from '../App';
import type { GameState, Message } from '../game/types';
import { Segmented, Sheet } from '../ui';
import { isImportant } from '../nav/alerts';
import { useNav } from '../nav/context';

const FROM_ICON: Record<Message['from'], string> = { director: '💼', club: '🏛️', liga: '🏆', prensa: '📰' };

/** Pantallas a las que remite un mensaje (por lo que dice su texto o su título) */
const DESTINOS: { re: RegExp; tab: TabId; sub?: string; label: string }[] = [
  { re: /Dirección → Empleados|entrenador|ojeadores \(|Leyenda del club/i, tab: 'direccion', sub: 'empleados', label: 'Empleados' },
  { re: /Dirección → Presupuestos|tope de salarios|Súbelos/i, tab: 'direccion', sub: 'presupuestos', label: 'Presupuestos' },
  { re: /Dirección → Director/i, tab: 'direccion', sub: 'director', label: 'Director' },
  { re: /Equipo → Mercado|en Mercado|Mercado →|📨 Oferta/i, tab: 'equipo', sub: 'mercado', label: 'Mercado' },
  { re: /Finanzas → Patrocin|patrocinador/i, tab: 'finanzas', sub: 'patrocinadores', label: 'Patrocinio' },
  { re: /en Plantilla|🤕|se retirará|cedido|Fin de las cesiones/i, tab: 'equipo', sub: 'plantilla', label: 'Plantilla' },
  { re: /Copa|Supercopa|Sorteo/i, tab: 'equipo', sub: 'copa', label: 'Copas' },
  { re: /préstamo|inversor|Reparto/i, tab: 'finanzas', sub: 'banca', label: 'Banca' },
];

/** Bandeja de mensajes, se abre desde la cabecera */
export default function Bandeja({ s, update, onClose }: { s: GameState; update: Update; onClose: () => void }) {
  const { go, openPlayer } = useNav();
  const [abierto, setAbierto] = useState<number | null>(null);
  const [filtro, setFiltro] = useState<'importantes' | 'todos'>('importantes');
  const todos = s.messages.filter((m) => m.status !== 'pendiente').slice(0, 80);
  const mensajes = filtro === 'importantes' ? todos.filter(isImportant) : todos;
  const sinLeer = todos.filter((m) => !m.read).length;
  // jugadores que aparecen en el título (los nuestros primero)
  const jugadoresDe = (m: Message) => {
    const vistos = new Set<string>();
    return [...s.players]
      .sort((a, b) => Number(b.teamId === s.club.teamId) - Number(a.teamId === s.club.teamId))
      .filter((p) => m.title.includes(p.name) && !vistos.has(p.name) && vistos.add(p.name))
      .slice(0, 2);
  };

  return (
    <Sheet title="📬 Bandeja" onClose={onClose}>
      <Segmented
        value={filtro}
        onChange={setFiltro}
        options={[
          { value: 'importantes', label: `Importantes (${todos.filter((m) => isImportant(m) && !m.read).length})` },
          { value: 'todos', label: `Todos (${sinLeer})` },
        ]}
      />
      {sinLeer > 0 && (
        <button
          className="link small"
          onClick={() => update((g) => g.messages.forEach((m) => { if (m.status !== 'pendiente') m.read = true; }))}
        >
          Marcar todo como leído ({sinLeer})
        </button>
      )}
      {mensajes.length === 0 && <p className="muted">Sin mensajes.</p>}
      {mensajes.map((m) => {
        const destino = abierto === m.id ? DESTINOS.find((d) => d.re.test(`${m.title}\n${m.body}`)) : undefined;
        const jugadores = abierto === m.id ? jugadoresDe(m) : [];
        return (
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
            {abierto === m.id && (
              <>
                <p className="pre">{m.body}</p>
                {(destino || jugadores.length > 0) && (
                  <div className="msg-actions">
                    {jugadores.map((p) => (
                      <button key={p.id} className="btn small" onClick={() => openPlayer(p.id)}>👤 {p.name}</button>
                    ))}
                    {destino && (
                      <button className="btn small primary" onClick={() => go(destino.tab, destino.sub)}>Ir a {destino.label} ›</button>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        );
      })}
    </Sheet>
  );
}

/** Para el contador del buzón solo cuentan los mensajes importantes */
export const unreadCount = (s: GameState) => s.messages.filter((m) => !m.read && m.status !== 'pendiente' && isImportant(m)).length;
