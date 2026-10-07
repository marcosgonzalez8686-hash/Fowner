import { useCallback, useEffect, useState } from 'react';
import { DIVISION_NAMES } from './game/economy';
import { newGame } from './game/generate';
import { myTeam } from './game/market';
import { deleteGame, loadGame, saveGame, type Slot } from './game/save';
import type { GameState } from './game/types';
import { Money } from './ui';
import Crest from './components/Crest';
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
  // al entrar siempre se muestra el menú de partidas
  const [slot, setSlot] = useState<Slot | null>(null);
  const [state, setState] = useState<GameState | null>(null);
  const [tab, setTab] = useState<TabId>('inicio');
  const [toast, setToast] = useState<string | null>(null);

  // Todas las acciones trabajan sobre una copia y la guardan en el móvil
  const update: Update = useCallback(
    (fn) => {
      if (!state || !slot) return;
      const copia = structuredClone(state);
      const result = fn(copia);
      if (!saveGame(slot, copia)) setToast('⚠️ No se ha podido guardar la partida en este navegador');
      setState(copia);
      return result;
    },
    [state, slot],
  );

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(t);
  }, [toast]);

  const salirAlMenu = () => {
    setState(null);
    setSlot(null);
  };

  if (!state || !slot) {
    return (
      <Start
        onNew={(n, nombre, identity, opts) => {
          const s = newGame(nombre, identity, opts);
          saveGame(n, s);
          setSlot(n);
          setState(s);
          setTab('inicio');
        }}
        onLoad={(n) => {
          const s = loadGame(n);
          if (!s) {
            alert('No se ha podido cargar esta partida.');
            return;
          }
          setSlot(n);
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
        <div className="top-left">
          <Crest c={state.club.identity.crest} size={34} />
          <div>
          <div className="club-name">{team.name}</div>
          <div className="sub">
            {DIVISION_NAMES[team.division]} · T{state.season} ·{' '}
            {state.phase === 'pretemporada' ? 'Pretemporada' : `J${state.matchday}/38`}
          </div>
          </div>
        </div>
        <div className="top-right">
          <div className="cash">
            <div className="sub">Caja</div>
            <Money v={state.club.cash} />
          </div>
          <button className="menu-btn" onClick={salirAlMenu} aria-label="Menú de partidas" title="Menú de partidas">
            ☰
          </button>
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
                deleteGame(slot);
                salirAlMenu();
              }}
            >
              Borrar partida y volver al menú
            </button>
            <button className="btn full" onClick={salirAlMenu}>
              Volver al menú
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
                onMenu={salirAlMenu}
                onDelete={() => {
                  deleteGame(slot);
                  salirAlMenu();
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
