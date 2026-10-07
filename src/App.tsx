import { useCallback, useEffect, useState } from 'react';
import { DIVISION_NAMES } from './game/economy';
import { newGame } from './game/generate';
import { marketOpen, myTeam } from './game/market';
import { deleteGame, loadGame, saveGame, type Slot } from './game/save';
import type { GameState } from './game/types';
import { Money, Sheet } from './ui';
import Crest from './components/Crest';
import Bandeja, { unreadCount } from './components/Bandeja';
import Sponsors from './components/Sponsors';
import Inicio, { pendingCount } from './screens/Inicio';
import Liga from './screens/Liga';
import Copa from './screens/Copa';
import Plantilla from './screens/Plantilla';
import Mercado from './screens/Mercado';
import DirectorScreen from './screens/Director';
import Empleados from './screens/Empleados';
import Presupuestos from './screens/Presupuestos';
import Resumen from './screens/Resumen';
import Entradas from './screens/Entradas';
import Banca from './screens/Banca';
import Instalaciones from './screens/Instalaciones';
import Tabs from './screens/Tabs';
import Start from './screens/Start';

export type Update = (fn: (s: GameState) => string | void) => string | void;

// Cinco áreas, una por cada parte del trabajo del dueño
const TABS = [
  { id: 'inicio', label: 'Inicio', icon: '🏠' },
  { id: 'equipo', label: 'Equipo', icon: '⚽' },
  { id: 'direccion', label: 'Dirección', icon: '💼' },
  { id: 'finanzas', label: 'Finanzas', icon: '💰' },
  { id: 'instalaciones', label: 'Instalac.', icon: '🏟️' },
] as const;
export type TabId = (typeof TABS)[number]['id'];

/** Subapartado inicial de cada pestaña */
const DEFAULT_SUB: Record<TabId, string> = {
  inicio: '',
  equipo: 'plantilla',
  direccion: 'director',
  finanzas: 'resumen',
  instalaciones: '',
};

export default function App() {
  // al entrar siempre se muestra el menú de partidas
  const [slot, setSlot] = useState<Slot | null>(null);
  const [state, setState] = useState<GameState | null>(null);
  const [tab, setTab] = useState<TabId>('inicio');
  const [sub, setSub] = useState<Record<TabId, string>>(DEFAULT_SUB);
  const [toast, setToast] = useState<string | null>(null);
  const [panel, setPanel] = useState<'bandeja' | 'menu' | null>(null);

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
    setPanel(null);
    setState(null);
    setSlot(null);
  };

  const entrar = (n: Slot, s: GameState) => {
    setSlot(n);
    setState(s);
    setTab('inicio');
    setSub(DEFAULT_SUB);
  };

  if (!state || !slot) {
    return (
      <Start
        onNew={(n, nombre, identity, opts) => {
          const s = newGame(nombre, identity, opts);
          saveGame(n, s);
          entrar(n, s);
        }}
        onLoad={(n) => {
          const s = loadGame(n);
          if (!s) {
            alert('No se ha podido cargar esta partida.');
            return;
          }
          entrar(n, s);
        }}
      />
    );
  }

  const team = myTeam(state);
  const pendientes = pendingCount(state);
  const sinLeer = unreadCount(state);
  const go = (t: TabId, subTab?: string) => {
    setTab(t);
    if (subTab) setSub((x) => ({ ...x, [t]: subTab }));
    window.scrollTo(0, 0);
  };
  const props = { s: state, update, notify: setToast, go };
  const subProps = <T extends string>(t: TabId) => ({
    value: sub[t] as T,
    onChange: (v: T) => setSub((x) => ({ ...x, [t]: v })),
  });

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
          <button className="menu-btn" onClick={() => setPanel('bandeja')} aria-label={`Bandeja, ${sinLeer} sin leer`}>
            📬
            {sinLeer > 0 && <span className="badge small-badge">{sinLeer > 99 ? '99+' : sinLeer}</span>}
          </button>
          <button className="menu-btn" onClick={() => setPanel('menu')} aria-label="Menú">
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

            {tab === 'equipo' && (
              <Tabs
                {...subProps('equipo')}
                options={[
                  { value: 'plantilla', label: '👕 Plantilla' },
                  { value: 'mercado', label: marketOpen(state) ? '🔁 Mercado' : '🔒 Mercado' },
                  { value: 'liga', label: '📊 Liga' },
                  { value: 'copa', label: '🏆 Copa' },
                ]}
              >
                {sub.equipo === 'plantilla' && <Plantilla {...props} />}
                {sub.equipo === 'mercado' && <Mercado {...props} />}
                {sub.equipo === 'liga' && <Liga {...props} />}
                {sub.equipo === 'copa' && <Copa {...props} />}
              </Tabs>
            )}

            {tab === 'direccion' && (
              <Tabs
                {...subProps('direccion')}
                options={[
                  { value: 'director', label: '💼 Director' },
                  { value: 'empleados', label: '👔 Empleados' },
                  { value: 'presupuestos', label: '💸 Presupuesto' },
                ]}
              >
                {sub.direccion === 'director' && <DirectorScreen {...props} />}
                {sub.direccion === 'empleados' && <Empleados {...props} />}
                {sub.direccion === 'presupuestos' && <Presupuestos {...props} />}
              </Tabs>
            )}

            {tab === 'finanzas' && (
              <Tabs
                {...subProps('finanzas')}
                options={[
                  { value: 'resumen', label: '📈 Resumen' },
                  { value: 'patrocinadores', label: '🤝 Patrocinio' },
                  { value: 'entradas', label: '🎟️ Entradas' },
                  { value: 'banca', label: '🏦 Banca' },
                ]}
              >
                {sub.finanzas === 'resumen' && <Resumen {...props} />}
                {sub.finanzas === 'patrocinadores' && <Sponsors s={state} update={update} notify={setToast} />}
                {sub.finanzas === 'entradas' && <Entradas {...props} />}
                {sub.finanzas === 'banca' && <Banca {...props} />}
              </Tabs>
            )}

            {tab === 'instalaciones' && <Instalaciones {...props} />}
          </>
        )}
      </main>

      {toast && <div className="toast" role="status">{toast}</div>}

      {panel === 'bandeja' && <Bandeja s={state} update={update} onClose={() => setPanel(null)} />}
      {panel === 'menu' && (
        <Sheet title="Menú" onClose={() => setPanel(null)}>
          <p className="small muted">
            Partida guardada en el hueco {slot}. Se guarda sola después de cada acción.
          </p>
          <button className="btn full" onClick={salirAlMenu}>
            Cambiar de partida
          </button>
          <button
            className="btn danger full"
            onClick={() => {
              if (confirm('¿Seguro? Se borrará esta partida y no se puede deshacer.')) {
                deleteGame(slot);
                salirAlMenu();
              }
            }}
          >
            Vender el club (borrar esta partida)
          </button>
        </Sheet>
      )}

      <nav className="tabs">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => go(t.id)}>
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
  go: (t: TabId, sub?: string) => void;
};
