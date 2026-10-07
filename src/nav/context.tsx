import { createContext, useContext, type ReactNode } from 'react';
import type { TabId } from '../App';

// Navegación global: ir a una pantalla y abrir la ficha de un jugador o de un equipo desde cualquier sitio.

export interface Nav {
  go: (t: TabId, sub?: string) => void;
  openPlayer: (id: number) => void;
  openTeam: (id: number) => void;
}

export const NavContext = createContext<Nav>({ go: () => {}, openPlayer: () => {}, openTeam: () => {} });
export const useNav = () => useContext(NavContext);

/** Nombre de jugador que abre su ficha */
export function PlayerLink({ id, children }: { id?: number; children: ReactNode }) {
  const { openPlayer } = useNav();
  if (id === undefined) return <>{children}</>;
  return (
    <button
      type="button"
      className="inline-link"
      onClick={(e) => {
        e.stopPropagation();
        openPlayer(id);
      }}
    >
      {children}
    </button>
  );
}

/** Nombre de equipo que abre su ficha */
export function TeamLink({ id, children }: { id?: number | null; children: ReactNode }) {
  const { openTeam } = useNav();
  if (id === undefined || id === null) return <>{children}</>;
  return (
    <button
      type="button"
      className="inline-link"
      onClick={(e) => {
        e.stopPropagation();
        openTeam(id);
      }}
    >
      {children}
    </button>
  );
}
