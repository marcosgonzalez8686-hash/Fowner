import { Suspense, lazy, useMemo, useState } from 'react';
import Crest from '../components/Crest';
import { CrestEditor, KitsEditor } from '../components/Editors';
import KitView from '../components/KitView';
import { defaultIdentity, initialsFrom, type Identity } from '../game/identity';
import { makeDirectors, type NewGameOptions } from '../game/generate';
import { STYLE_LABEL } from '../game/director';
import { DIVISIONS, fmtMoney } from '../game/economy';
import type { Director, GameState, Level } from '../game/types';
import { Segmented, Stars } from '../ui';
import { DIFFICULTY, DIFFICULTY_KEYS, type Difficulty } from '../game/difficulty';
import { DEFAULT_STADIUM, LAND_SIZE, clampStadium } from '../game/land';
import type { MapModel } from '../components/Map3D';

const Map3D = lazy(() => import('../components/Map3D'));

interface Props {
  onCancel: () => void;
  onCreate: (clubName: string, identity: Identity, opts: NewGameOptions) => void;
}

const PASOS = ['Tú', 'Club', 'Escudo', 'Equipo', 'Estadio', 'Director', 'Resumen'];

export default function NewGame({ onCancel, onCreate }: Props) {
  const [paso, setPaso] = useState(0);
  const [club, setClub] = useState('');
  const [id, setId] = useState<Identity>(() => ({ ...defaultIdentity(), stadium: '' }));
  // las iniciales del escudo siguen al nombre del club hasta que el usuario las toque
  const [inicialesTocadas, setInicialesTocadas] = useState(false);
  const [estadio, setEstadio] = useState(DEFAULT_STADIUM);
  // candidatos a director deportivo de la Liga Comarcal (sueldos de la última división)
  const [candidatos] = useState<Director[]>(() => makeDirectors({ nextId: 1 } as unknown as GameState, DIVISIONS - 1));
  const [director, setDirector] = useState<Director | null>(null);
  const [delegar, setDelegar] = useState<Level>('propone');
  const [dificultad, setDificultad] = useState<Difficulty>('normal');

  // terreno virgen con el estadio donde el dueño lo coloque
  const mapa: MapModel = useMemo(() => {
    const tiles = [];
    for (let y = 0; y < LAND_SIZE; y++) {
      for (let x = 0; x < LAND_SIZE; x++) {
        const dentro = x >= estadio.x && x <= estadio.x + 1 && y >= estadio.y && y <= estadio.y + 1;
        tiles.push({ x, y, state: dentro ? ('owned' as const) : ('locked' as const), stadium: dentro });
      }
    }
    return { size: LAND_SIZE, tiles, capacity: 600, standColor: id.home.shirt, accentColor: id.home.shirt2, selected: null };
  }, [estadio, id.home]);

  const set = <K extends keyof Identity>(k: K, v: Identity[K]) => setId((x) => ({ ...x, [k]: v }));

  const errores = [
    !id.ownerName.trim() || !id.ownerSurname.trim() ? 'Escribe tu nombre y tus apellidos.' : '',
    !club.trim() || !id.stadium.trim() ? 'Ponle nombre al club y al estadio.' : '',
    '',
    '',
    '',
    '',
    '',
  ];

  const siguiente = () => {
    if (errores[paso]) return;
    if (paso === 1 && !inicialesTocadas) set('crest', { ...id.crest, initials: initialsFrom(club) });
    setPaso(paso + 1);
  };

  const crear = () =>
    onCreate(
      club.trim(),
      { ...id, ownerName: id.ownerName.trim(), ownerSurname: id.ownerSurname.trim(), stadium: id.stadium.trim() },
      { stadium: estadio, director: director ?? undefined, delegation: delegar, difficulty: dificultad },
    );

  return (
    <div className="start wizard">
      <div className="steps" aria-label={`Paso ${paso + 1} de ${PASOS.length}`}>
        {PASOS.map((p, i) => (
          <span key={p} className={i === paso ? 'on' : i < paso ? 'done' : ''}>
            {p}
          </span>
        ))}
      </div>

      {paso === 0 && (
        <>
          <h1>¿Quién compra el club?</h1>
          <p className="lead">Así te llamarán en el club y en la prensa.</p>
          <label className="field">
            <span>Nombre</span>
            <input value={id.ownerName} maxLength={30} autoFocus autoComplete="given-name" onChange={(e) => set('ownerName', e.target.value)} />
          </label>
          <label className="field">
            <span>Apellidos</span>
            <input value={id.ownerSurname} maxLength={40} autoComplete="family-name" onChange={(e) => set('ownerSurname', e.target.value)} />
          </label>
        </>
      )}

      {paso === 1 && (
        <>
          <h1>Tu club</h1>
          <p className="lead">Empiezas en la Liga Comarcal, la quinta división.</p>
          <label className="field">
            <span>Nombre del club</span>
            <input value={club} maxLength={28} autoFocus placeholder="Ej.: CD Villarrosal" onChange={(e) => setClub(e.target.value)} />
          </label>
          <label className="field">
            <span>Nombre del estadio</span>
            <input value={id.stadium} maxLength={36} placeholder="Ej.: Campo Municipal La Vega" onChange={(e) => set('stadium', e.target.value)} />
          </label>
        </>
      )}

      {paso === 2 && (
        <>
          <h1>Diseña el escudo</h1>
          <CrestEditor
            value={id.crest}
            onChange={(c) => {
              if (c.initials !== id.crest.initials) setInicialesTocadas(true);
              set('crest', c);
            }}
          />
        </>
      )}

      {paso === 3 && (
        <>
          <h1>Equipaciones</h1>
          <KitsEditor home={id.home} away={id.away} onChange={(home, away) => setId((x) => ({ ...x, home, away }))} />
        </>
      )}

      {paso === 4 && (
        <>
          <h1>¿Dónde construyes el estadio?</h1>
          <p className="lead">
            Toca el terreno para colocarlo. Al principio no tendrá gradas: el público verá el partido de pie.
            Alrededor podrás comprar parcelas para crecer, así que piensa hacia dónde quieres expandirte.
          </p>
          <Suspense fallback={<div className="map3d map3d-error">Cargando mapa 3D…</div>}>
            <Map3D model={mapa} onSelect={(x, y) => setEstadio(clampStadium(x, y))} />
          </Suspense>
          <div className="row">
            <button className="btn small grow" onClick={() => setEstadio(DEFAULT_STADIUM)}>Centrar</button>
          </div>
        </>
      )}

      {paso === 5 && (
        <>
          <h1>¿Contratas un director deportivo?</h1>
          <p className="lead">
            Es opcional. Puede encargarse de fichajes, ventas, renovaciones, cantera y de contratar a los empleados.
            Cuanto mejor es, más cobra. También podrás contratarlo más tarde.
          </p>
          <button className={`slot as-btn${director === null ? ' chosen' : ''}`} onClick={() => setDirector(null)}>
            <span className="slot-num">🧑‍💼</span>
            <span className="slot-info">
              <b>Ninguno, lo haré yo</b>
              <small>Todas las decisiones deportivas son tuyas</small>
            </span>
          </button>
          {candidatos.map((c) => (
            <button key={c.id} className={`slot as-btn${director?.id === c.id ? ' chosen' : ''}`} onClick={() => setDirector(c)}>
              <span className="slot-num">💼</span>
              <span className="slot-info">
                <b>{c.name} <Stars n={c.stars} /></b>
                <small>{STYLE_LABEL[c.style]} · {fmtMoney(c.salary)}/temporada</small>
              </span>
            </button>
          ))}
          {director && (
            <>
              <h4>¿Qué le encargas al empezar?</h4>
              <Segmented
                value={delegar}
                onChange={setDelegar}
                options={[
                  { value: 'manual', label: 'Nada aún' },
                  { value: 'propone', label: 'Me propone' },
                  { value: 'auto', label: 'Todo él' },
                ]}
              />
              <p className="small muted">Luego puedes ajustarlo tarea por tarea en Dirección.</p>
            </>
          )}
        </>
      )}

      {paso === 6 && (
        <>
          <h1>Todo listo</h1>
          <div className="summary">
            <Crest c={id.crest} size={96} />
            <div className="summary-name">{club}</div>
            <div className="muted">🏟️ {id.stadium}</div>
            <div className="muted">Presidente: {id.ownerName} {id.ownerSurname}</div>
            <div className="muted">Director deportivo: {director ? director.name : 'ninguno'}</div>
            <div className="kits-row">
              <figure>
                <KitView k={id.home} size={64} />
                <figcaption>Titular</figcaption>
              </figure>
              <figure>
                <KitView k={id.away} size={64} />
                <figcaption>Suplente</figcaption>
              </figure>
            </div>
          </div>
          <h2>Dificultad</h2>
          <Segmented
            value={dificultad}
            onChange={setDificultad}
            options={DIFFICULTY_KEYS.map((k) => ({ value: k, label: `${DIFFICULTY[k].icon} ${DIFFICULTY[k].label}` }))}
          />
          <p className="small muted">
            {DIFFICULTY[dificultad].desc} Empiezas con {fmtMoney(Math.round(180_000 * DIFFICULTY[dificultad].cash))} en caja. No se puede cambiar después.
          </p>
        </>
      )}

      {errores[paso] && <p className="small muted center">{errores[paso]}</p>}

      <div className="wizard-nav">
        <button className="btn" onClick={() => (paso === 0 ? onCancel() : setPaso(paso - 1))}>
          {paso === 0 ? 'Cancelar' : 'Atrás'}
        </button>
        {paso < PASOS.length - 1 ? (
          <button className="btn primary grow" disabled={Boolean(errores[paso])} onClick={siguiente}>
            Siguiente
          </button>
        ) : (
          <button className="btn primary grow" onClick={crear}>
            Comprar el club
          </button>
        )}
      </div>
    </div>
  );
}
