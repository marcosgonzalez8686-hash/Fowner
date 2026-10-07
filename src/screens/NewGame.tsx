import { Suspense, lazy, useMemo, useState } from 'react';
import Crest from '../components/Crest';
import { CrestEditor, KitsEditor } from '../components/Editors';
import KitView from '../components/KitView';
import { defaultIdentity, initialsFrom, type Identity } from '../game/identity';
import { DEFAULT_STADIUM, LAND_SIZE, clampStadium } from '../game/land';
import type { MapModel } from '../components/Map3D';

const Map3D = lazy(() => import('../components/Map3D'));

interface Props {
  onCancel: () => void;
  onCreate: (clubName: string, identity: Identity, stadium: { x: number; y: number }) => void;
}

const PASOS = ['Tú', 'Club', 'Escudo', 'Equipación', 'Estadio', 'Resumen'];

export default function NewGame({ onCancel, onCreate }: Props) {
  const [paso, setPaso] = useState(0);
  const [club, setClub] = useState('');
  const [id, setId] = useState<Identity>(() => ({ ...defaultIdentity(), stadium: '' }));
  // las iniciales del escudo siguen al nombre del club hasta que el usuario las toque
  const [inicialesTocadas, setInicialesTocadas] = useState(false);
  const [estadio, setEstadio] = useState(DEFAULT_STADIUM);

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
      estadio,
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
          <h1>Todo listo</h1>
          <div className="summary">
            <Crest c={id.crest} size={96} />
            <div className="summary-name">{club}</div>
            <div className="muted">🏟️ {id.stadium}</div>
            <div className="muted">Presidente: {id.ownerName} {id.ownerSurname}</div>
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
