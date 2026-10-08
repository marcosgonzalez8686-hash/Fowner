import { useCallback, useEffect, useState } from 'react';
import { DIVISION_NAMES } from './game/economy';
import { newGame } from './game/generate';
import { marketOpen, myTeam } from './game/market';
import { deleteGame, loadGame, onSaveError, saveGame, type Slot } from './game/save';
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
import Historia from './screens/Historia';
import Identidad from './screens/Identidad';
import Tabs from './screens/Tabs';
import Start from './screens/Start';
import PlayerSheet from './components/PlayerSheet';
import TeamSheet from './components/TeamSheet';
import Intro from './components/Intro';
import { NavContext } from './nav/context';
import { pushBack } from './nav/back';
import { tabAlerts } from './nav/alerts';

export type Update = (fn: (s: GameState) => string | void) => string | void;

// Cinco áreas, una por cada parte del trabajo del dueño
const TABS = [
  { id: 'inicio', label: 'Inicio', icon: '🏠' },
  { id: 'equipo', label: 'Equipo', icon: '⚽' },
  { id: 'direccion', label: 'Dirección', icon: '💼' },
  { id: 'finanzas', label: 'Finanzas', icon: '💰' },
  { id: 'instalaciones', label: 'Club', icon: '🏟️' },
] as const;
export type TabId = (typeof TABS)[number]['id'];

/** Subapartado inicial de cada pestaña */
const DEFAULT_SUB: Record<TabId, string> = {
  inicio: '',
  equipo: 'plantilla',
  direccion: 'director',
  finanzas: 'resumen',
  instalaciones: 'instalaciones',
};

export default function App() {
  // al entrar siempre se muestra el menú de partidas
  const [slot, setSlot] = useState<Slot | null>(null);
  const [state, setState] = useState<GameState | null>(null);
  const [tab, setTab] = useState<TabId>('inicio');
  const [sub, setSub] = useState<Record<TabId, string>>(DEFAULT_SUB);
  const [toast, setToast] = useState<string | null>(null);
  const [panel, setPanel] = useState<'bandeja' | 'menu' | null>(null);
  const [verIntro, setVerIntro] = useState(false);
  // fichas abiertas desde cualquier pantalla
  // se apilan: desde la ficha de un equipo se abre la de un jugador y al cerrarla se vuelve al equipo
  const [fichas, setFichas] = useState<{ kind: 'player' | 'team'; id: number }[]>([]);

  useEffect(() => onSaveError(() => setToast('⚠️ No se ha podido guardar la partida en este navegador')), []);

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
    setFichas([]);
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
  // cada cambio de pantalla se puede deshacer con el botón atrás del móvil
  const recordar = () => {
    const antes = { tab, sub };
    pushBack(() => {
      setTab(antes.tab);
      setSub(antes.sub);
      window.scrollTo(0, 0);
    });
  };
  const go = (t: TabId, subTab?: string) => {
    if (t !== tab || (subTab && subTab !== sub[t])) recordar();
    setFichas([]);
    setPanel(null);
    setTab(t);
    if (subTab) setSub((x) => ({ ...x, [t]: subTab }));
    window.scrollTo(0, 0);
  };
  const nav = {
    go,
    openPlayer: (id: number) => setFichas((f) => [...f, { kind: 'player' as const, id }]),
    openTeam: (id: number) => (id === state.club.teamId ? go('equipo', 'plantilla') : setFichas((f) => [...f, { kind: 'team' as const, id }])),
  };
  const props = { s: state, update, notify: setToast, go };
  const avisos = tabAlerts(state);
  const subProps = <T extends string>(t: TabId) => ({
    value: sub[t] as T,
    onChange: (v: T) => {
      if (v !== sub[t]) recordar();
      setSub((x) => ({ ...x, [t]: v }));
    },
  });
  const conAviso = (label: string, n: number | undefined) => (n ? `${label} (${n})` : label);

  return (
    <NavContext.Provider value={nav}>
    <div className="app">
      <header className="topbar">
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
          <button className="menu-btn" onClick={() => setPanel('bandeja')} aria-label={`Bandeja, ${sinLeer} importantes sin leer`}>
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
                  { value: 'plantilla', label: conAviso('👕 Plantilla', avisos.sub.plantilla) },
                  { value: 'mercado', label: conAviso(marketOpen(state) ? '🔁 Mercado' : '🔒 Mercado', avisos.sub.mercado) },
                  { value: 'liga', label: '📊 Liga' },
                  { value: 'copa', label: '🏆 Copas' },
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
                  { value: 'empleados', label: conAviso('👔 Empleados', avisos.sub.empleados) },
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
                  { value: 'patrocinadores', label: conAviso('🤝 Patrocinio', avisos.sub.patrocinadores) },
                  { value: 'entradas', label: '🎟️ Entradas' },
                  { value: 'banca', label: conAviso('🏦 Banca', avisos.sub.banca) },
                ]}
              >
                {sub.finanzas === 'resumen' && <Resumen {...props} />}
                {sub.finanzas === 'patrocinadores' && <Sponsors s={state} update={update} notify={setToast} />}
                {sub.finanzas === 'entradas' && <Entradas {...props} />}
                {sub.finanzas === 'banca' && <Banca {...props} />}
              </Tabs>
            )}

            {tab === 'instalaciones' && (
              <Tabs
                {...subProps('instalaciones')}
                options={[
                  { value: 'instalaciones', label: '🏗️ Instalaciones' },
                  { value: 'historia', label: '📜 Historia' },
                  { value: 'identidad', label: '🛡️ Identidad' },
                ]}
              >
                {sub.instalaciones === 'instalaciones' && <Instalaciones {...props} />}
                {sub.instalaciones === 'historia' && <Historia {...props} />}
                {sub.instalaciones === 'identidad' && <Identidad {...props} />}
              </Tabs>
            )}
          </>
        )}
      </main>

      {toast && <div className="toast" role="status">{toast}</div>}

      {panel === 'bandeja' && <Bandeja s={state} update={update} onClose={() => setPanel(null)} />}
      {fichas.map((f, i) => {
        const cerrar = () => setFichas((x) => x.slice(0, i));
        return f.kind === 'player'
          ? <PlayerSheet key={`${i}-${f.id}`} s={state} update={update} notify={setToast} id={f.id} onClose={cerrar} />
          : <TeamSheet key={`${i}-${f.id}`} s={state} id={f.id} onClose={cerrar} />;
      })}
      {panel === 'menu' && (
        <Sheet title="Menú" onClose={() => setPanel(null)}>
          <p className="small muted">
            Partida guardada en el hueco {slot}. Se guarda sola después de cada acción.
          </p>
          <button className="btn full" onClick={() => { setPanel(null); setVerIntro(true); }}>
            📖 Cómo se juega
          </button>
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

      {(state.introPending || verIntro) && !state.gameOver && (
        <Intro
          onClose={() => {
            setVerIntro(false);
            if (state.introPending) update((g) => { g.introPending = false; });
          }}
        />
      )}

      <nav className="tabs">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => go(t.id)}>
            <span className="ico" aria-hidden>{t.icon}</span>
            <span>{t.label}</span>
            {t.id === 'inicio' && pendientes > 0 && <span className="badge">{pendientes}</span>}
            {t.id !== 'inicio' && avisos.tab[t.id] ? <span className="badge">{avisos.tab[t.id]}</span> : null}
            {t.id !== 'inicio' && !avisos.tab[t.id] && avisos.dot[t.id] ? <span className="badge dot" aria-label="novedades" /> : null}
          </button>
        ))}
      </nav>
    </div>
    </NavContext.Provider>
  );
}

export type ScreenProps = {
  s: GameState;
  update: Update;
  notify: (msg: string) => void;
  go: (t: TabId, sub?: string) => void;
};
