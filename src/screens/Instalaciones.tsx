import { Suspense, lazy, useMemo, useState } from 'react';
import type { ScreenProps } from '../App';
import { STADIUM_REQ, stadiumFine } from '../game/costs';
import type { MapModel } from '../components/Map3D';
import {
  FOOTPRINT_STEPS, STADIUM_MODELS, STADIUM_MODEL_KEYS, expandStadium, expansionNeeds, modelInfo, remodelCost, remodelStadium, stadiumBlock,
  stadiumCost, stadiumModel,
} from '../game/stadium';
import { fmtMoney } from '../game/economy';
import { myTeam } from '../game/market';
import {
  BUILDINGS, LAND_SIZE, STANDING, buildingLevel, buyParcel, canBuyParcel, construct, isBuilt, maintenancePerSeason,
  buildCost, buildingParcels, nextLevelCost, parcelCost, placementFor, sizeLabel, upgrade, type BuildingKind,
} from '../game/land';
import { Card } from '../ui';

// el motor 3D pesa: se descarga solo al abrir esta pantalla
const Map3D = lazy(() => import('../components/Map3D'));

const KINDS = Object.keys(BUILDINGS) as BuildingKind[];

export default function Instalaciones({ s, update, notify }: ScreenProps) {
  const c = s.club;
  // al entrar se selecciona el estadio, esté donde esté
  const [sel, setSel] = useState<{ x: number; y: number } | null>(() => {
    const p = c.land.parcels.find((x) => x.stadium);
    return p ? { x: p.x, y: p.y } : null;
  });
  const parcela = sel ? c.land.parcels.find((p) => p.x === sel.x && p.y === sel.y) : undefined;
  // edificio cuyo hueco se está enseñando en el mapa antes de construirlo
  const [previa, setPrevia] = useState<BuildingKind | null>(null);
  const hueco = previa && parcela ? placementFor(s, previa, parcela.x, parcela.y) : null;

  const model: MapModel = useMemo(
    () => ({
      size: LAND_SIZE,
      capacity: c.capacity,
      stadiumModel: stadiumModel(s),
      standColor: c.identity.home.shirt,
      accentColor: c.identity.home.shirt2,
      selected: sel,
      highlight: hueco?.map((p) => ({ x: p.x, y: p.y })),
      tiles: c.land.parcels.map((p) => ({
        x: p.x,
        y: p.y,
        state: p.owned ? 'owned' : canBuyParcel(s, p) ? 'buyable' : 'locked',
        stadium: p.stadium,
        building: p.building,
        level: p.building ? buildingLevel(s, p.building) : undefined,
      })),
    }),
    // se rehace cuando cambia el terreno, el estadio, los colores o la selección
    [c.land, c.capacity, c.stadiumModel, c.identity.home, c.training, c.academy, sel, hueco],
  );

  const run = (fn: () => string | undefined | void, ok: string) => notify(fn() ?? ok);
  const propias = c.land.parcels.filter((p) => p.owned).length;
  const libres = c.land.parcels.filter((p) => p.owned && !p.stadium && !p.building).length;
  const porConstruir = KINDS.filter((k) => !isBuilt(s, k));

  return (
    <>
      <Card title="🗺️ Terreno del club" right={<span className="small muted">{propias} de {LAND_SIZE * LAND_SIZE} parcelas</span>}>
        <Suspense fallback={<div className="map3d map3d-error">Cargando mapa 3D…</div>}>
          <Map3D model={model} onSelect={(x, y) => { setSel({ x, y }); setPrevia(null); }} />
        </Suspense>
        <div className="legend-row map-legend">
          <span><i className="sw tile-owned" /> Tuyas</span>
          <span><i className="sw tile-buy" /> A la venta</span>
          <span><i className="sw tile-locked" /> No disponibles</span>
        </div>
        <p className="small muted center">Arrastra para girar, pellizca para acercar y toca una parcela.</p>
      </Card>

      {parcela && (
        <Card title={parcela.stadium ? `🏟️ ${c.identity.stadium}` : parcela.building ? `${BUILDINGS[parcela.building].icon} ${BUILDINGS[parcela.building].name}` : `Parcela ${parcela.x + 1}-${parcela.y + 1}`}>
          {parcela.stadium && (
            <>
              <p>Aforo: <b>{c.capacity.toLocaleString('es-ES')}</b> espectadores.</p>
              {(() => {
                const d = myTeam(s).division;
                const req = STADIUM_REQ[d];
                const sig = d > 0 ? STADIUM_REQ[d - 1] : 0;
                return (
                  <p className="small">
                    {req > c.capacity ? (
                      <b className="neg">⚠️ La liga exige {req.toLocaleString('es-ES')}: multa de {fmtMoney(stadiumFine(s, d))} al acabar la temporada.</b>
                    ) : (
                      <span className="muted">Cumple el mínimo de la liga ({req.toLocaleString('es-ES')}).</span>
                    )}
                    {sig > c.capacity && <span className="muted"> Si ascendemos, harán falta {sig.toLocaleString('es-ES')}.</span>}
                  </p>
                );
              })()}
              <p className="small">
                Modelo: <b>{modelInfo(s).icon} {modelInfo(s).name}</b>. <span className="muted">{modelInfo(s).effect}</span>
              </p>
              <p className="small muted">
                {c.capacity <= STANDING
                  ? `Todavía no hay gradas: caben ${STANDING} personas de pie alrededor de la valla. Amplía el aforo para construir la primera grada.`
                  : (() => {
                      // cuándo necesitará más terreno
                      const n = stadiumBlock(s).n;
                      const sig = [...FOOTPRINT_STEPS].reverse().find(([desde, lado]) => lado > n && desde >= c.capacity);
                      return `Ocupa ${n}×${n} parcelas.` + (sig ? ` Por encima de ${sig[0].toLocaleString('es-ES')} espectadores necesitará ${sig[1]}×${sig[1]}: ten comprado y libre el terreno de alrededor.` : '');
                    })()}
              </p>
              {c.works ? (
                <p className="hint">
                  🚧 {c.works.kind === 'remodelacion' && c.works.model
                    ? `Remodelación a ${STADIUM_MODELS[c.works.model].name.toLowerCase()}`
                    : `Obras en marcha: +${c.works.amount.toLocaleString('es-ES')} asientos`}, faltan {c.works.matchdaysLeft} jornadas.
                </p>
              ) : (
                <>
                  <div className="row wrap">
                    {(c.capacity >= 15_000 ? [1000, 5000, 10_000] : [250, 1000, 5000]).map((n) => {
                      const tope = modelInfo(s).maxCapacity;
                      const need = expansionNeeds(s, n);
                      const bloqueado = (tope !== undefined && c.capacity + n > tope) || (need.grows && !need.block);
                      return (
                        <button
                          key={n}
                          className="btn"
                          disabled={c.cash < stadiumCost(s, n) || bloqueado}
                          onClick={() => run(() => update((g) => expandStadium(g, n)), 'Obras iniciadas')}
                        >
                          +{n.toLocaleString('es-ES')} asientos · {fmtMoney(stadiumCost(s, n))}
                          {need.grows && <small className="muted"> · {need.block ? `pasa a ${need.n}×${need.n}` : `necesita ${need.n}×${need.n} parcelas`}</small>}
                        </button>
                      );
                    })}
                  </div>
                  <details className="remodel">
                    <summary>Cambiar el modelo de estadio</summary>
                    <ul className="models">
                      {STADIUM_MODEL_KEYS.filter((k) => k !== stadiumModel(s)).map((k) => {
                        const m = STADIUM_MODELS[k];
                        const coste = remodelCost(s, k);
                        const cabe = !m.maxCapacity || c.capacity <= m.maxCapacity;
                        return (
                          <li key={k}>
                            <div>
                              <b>{m.icon} {m.name}</b>
                              <p className="small muted">{m.desc} {m.effect}</p>
                            </div>
                            <button className="btn" disabled={!cabe || c.cash < coste} onClick={() => run(() => update((g) => remodelStadium(g, k)), coste ? 'Remodelación iniciada' : 'Modelo cambiado')}>
                              {!cabe ? 'Demasiado grande' : coste ? fmtMoney(coste) : 'Gratis'}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </details>
                </>
              )}
            </>
          )}

          {parcela.building && (() => {
            const k = parcela.building;
            const info = BUILDINGS[k];
            const n = buildingLevel(s, k);
            const coste = nextLevelCost(s, k);
            return (
              <>
                <p>Nivel <b>{n}</b> de {info.maxLevel}</p>
                <p className="small muted">{info.help}</p>
                {info.size[0] * info.size[1] > 1 && (
                  <p className="small muted">
                    📐 {buildingParcels(s, k).length >= info.size[0] * info.size[1]
                      ? `Ocupa ${sizeLabel(k)}, ya reservadas para cuando crezca. ${info.grows ?? ''}`
                      : `Se construyó en una sola parcela: cuando tengas libres las de al lado, ocupará ${sizeLabel(k)}. ${info.grows ?? ''}`}
                  </p>
                )}
                {coste !== null ? (
                  <button className="btn primary full" disabled={c.cash < coste} onClick={() => run(() => update((g) => upgrade(g, k)), `${info.name}: nivel ${n + 1}`)}>
                    Mejorar a nivel {n + 1} · {fmtMoney(coste)}
                  </button>
                ) : (
                  <p className="hint">Al máximo nivel.</p>
                )}
              </>
            );
          })()}

          {!parcela.owned && (
            canBuyParcel(s, parcela) ? (
              <>
                <p className="small muted">Terreno junto al tuyo. Cuantas más parcelas compras, más caras son las siguientes.</p>
                <button
                  className="btn primary full"
                  disabled={c.cash < parcelCost(s, parcela)}
                  onClick={() => run(() => update((g) => buyParcel(g, parcela.x, parcela.y)), 'Parcela comprada')}
                >
                  Comprar parcela · {fmtMoney(parcelCost(s, parcela))}
                </button>
              </>
            ) : (
              <p className="muted">Esta parcela no está a la venta todavía: compra antes las que tiene al lado.</p>
            )
          )}

          {parcela.owned && !parcela.stadium && !parcela.building && (
            porConstruir.length ? (
              <>
                <p className="small muted">
                  Parcela libre. ¿Qué quieres construir? Cada edificio reserva desde el principio todo el terreno que ocupará al máximo nivel.
                  Toca 📐 para ver en el mapa dónde iría.
                </p>
                {porConstruir.map((k) => {
                  const sitio = placementFor(s, k, parcela.x, parcela.y);
                  const grande = BUILDINGS[k].size[0] * BUILDINGS[k].size[1] > 1;
                  return (
                    <div key={k} className={`facility ${previa === k ? 'previa' : ''}`}>
                      <div>
                        <b>{BUILDINGS[k].icon} {BUILDINGS[k].name}</b>
                        <div className="small muted">{BUILDINGS[k].help}</div>
                        <div className={`small ${sitio ? 'muted' : 'neg'}`}>
                          {grande && sitio && (
                            <button className="link small" onClick={() => setPrevia(previa === k ? null : k)}>
                              📐 {previa === k ? 'Ocultar' : 'Ver dónde'}
                            </button>
                          )}{' '}
                          Ocupa {sizeLabel(k)}
                          {sitio ? (grande ? '' : '.') : ': aquí no cabe. Necesitas parcelas propias y libres juntas.'}
                          {grande && sitio && <> · {BUILDINGS[k].grows}</>}
                        </div>
                      </div>
                      <button
                        className="btn small primary"
                        disabled={!sitio || c.cash < buildCost(s, k, 1)}
                        onClick={() => { setPrevia(null); run(() => update((g) => construct(g, k, parcela.x, parcela.y)), `${BUILDINGS[k].name} construido`); }}
                      >
                        {fmtMoney(buildCost(s, k, 1))}
                      </button>
                    </div>
                  );
                })}
              </>
            ) : (
              <p className="muted">Ya tienes todos los edificios disponibles.</p>
            )
          )}
        </Card>
      )}

      <Card title="🏗️ Tus instalaciones" right={<span className="small muted">Mant. {fmtMoney(maintenancePerSeason(s))}/temp.</span>}>
        {KINDS.filter((k) => isBuilt(s, k)).map((k) => {
          const p = c.land.parcels.find((x) => x.building === k)!;
          return (
            <button key={k} className="facility as-btn plain full-w" onClick={() => setSel({ x: p.x, y: p.y })}>
              <span>
                <b>{BUILDINGS[k].icon} {BUILDINGS[k].name}</b>
                <span className="small muted"> · nivel {buildingLevel(s, k)}/{BUILDINGS[k].maxLevel}</span>
              </span>
              <span className="slot-go">›</span>
            </button>
          );
        })}
        {porConstruir.length > 0 && (
          <p className="small muted">
            {libres > 0
              ? `Tienes ${libres} parcela(s) libre(s): tócala en el mapa para construir.`
              : 'No te quedan parcelas libres: compra terreno (las parcelas arenosas del mapa) para construir más.'}
          </p>
        )}
      </Card>

    </>
  );
}
