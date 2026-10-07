import { useCallback, useEffect, useState } from 'react';
import { DIVISION_NAMES } from './game/economy';
import { newGame } from './game/generate';
import { myTeam } from './game/market';
import { deleteGame, loadGame, saveGame } from './game/save';
import type { GameState } from './game/types';
import { Money } from './ui';
import Inicio from './screens/Inicio';
import Liga from './screens/Liga';
import Plantilla from './screens/Plantilla';
import Mercado from './screens/Mercado';
import ClubScreen from './screens/Club';
import DirectorScreen from './screens/Director';
import Start from './screens/Start';

export type Update = (fn: (s: GameState) => string | void) => string | void;

const TABS = [
  { id: 'inicio', label: 'Inicio', icon: '🏠' },
  { id: 'liga', label: 'Liga', icon: '🏆' },
  { id: 'plantilla', label: 'Plantilla', icon: '👕' },
  { id: 'mercado', label: 'Mercado', icon: '🔁' },
  { id: 'club', label: 'Club', icon: '🏟️' },
  { id: 'director', label: 'Director', icon: '💼' },
] as const;
type TabId = (typeof TABS)[number]['id'];

export default function App() {
  const [state, setState] = useState<GameState | null>(() => loadGame());
  const [tab, setTab] = useState<TabId>('inicio');
  const [toast, setToast] = useState<string | null>(null);

  // Todas las acciones trabajan sobre una copia y la guardan en el móvil
  const update: Update = useCallback(
    (fn) => {
      if (!state) return;
      const copia = structuredClone(state);
      const result = fn(copia);
      saveGame(copia);
      setState(copia);
      return result;
    },
    [state],
  );

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(t);
  }, [toast]);

  if (!state) {
    return (
      <Start
        onStart={(nombre) => {
          const s = newGame(nombre);
          saveGame(s);
          setState(s);
          setTab('inicio');
        }}
      />
    );
  }

  const team = myTeam(state);
  const pendientes = state.messages.filter((m) => m.status === 'pendiente').length;
  const props = { s: state, update, notify: setToast, go: (t: TabId) => setTab(t) };

  return (
    <div className="app">
      <header className="top">
        <div>
          <div className="club-name">{team.name}</div>
          <div className="sub">
            {DIVISION_NAMES[team.division]} · T{state.season} ·{' '}
            {state.phase === 'pretemporada' ? 'Pretemporada' : `J${state.matchday}/38`}
          </div>
        </div>
        <div className="cash">
          <div className="sub">Caja</div>
          <Money v={state.club.cash} />
        </div>
      </header>

      <main className="content">
        {state.gameOver ? (
          <div className="card gameover">
            <h2>Fin de la partida</h2>
            <p>{state.gameOver}</p>
            <button
              className="btn primary"
              onClick={() => {
                deleteGame();
                setState(null);
              }}
            >
              Empezar de nuevo
            </button>
          </div>
        ) : (
          <>
            {tab === 'inicio' && <Inicio {...props} />}
            {tab === 'liga' && <Liga {...props} />}
            {tab === 'plantilla' && <Plantilla {...props} />}
            {tab === 'mercado' && <Mercado {...props} />}
            {tab === 'club' && (
              <ClubScreen
                {...props}
                onQuit={() => {
                  deleteGame();
                  setState(null);
                }}
              />
            )}
            {tab === 'director' && <DirectorScreen {...props} />}
          </>
        )}
      </main>

      {toast && <div className="toast" role="status">{toast}</div>}

      <nav className="tabs">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>
            <span className="ico" aria-hidden>{t.icon}</span>
            <span>{t.label}</span>
            {t.id === 'inicio' && pendientes > 0 && <span className="badge">{pendientes}</span>}
          </button>
        ))}
      </nav>
    </div>
  );
}

export type ScreenProps = {
  s: GameState;
  update: Update;
  notify: (msg: string) => void;
  go: (t: TabId) => void;
};
