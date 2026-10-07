import { Suspense, lazy, useMemo, useState } from 'react';
import type { ScreenProps } from '../App';
import { STADIUM_REQ, stadiumFine } from '../game/costs';
import type { MapModel } from '../components/Map3D';
import { expandStadium, stadiumCost } from '../game/club';
import { fmtMoney } from '../game/economy';
import { myTeam } from '../game/market';
import {
  BUILDINGS, LAND_SIZE, STANDING, buildingLevel, buyParcel, canBuyParcel, construct, isBuilt, maintenancePerSeason,
  nextLevelCost, parcelCost, upgrade, type BuildingKind,
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

  const model: MapModel = useMemo(
    () => ({
      size: LAND_SIZE,
      capacity: c.capacity,
      standColor: c.identity.home.shirt,
      accentColor: c.identity.home.shirt2,
      selected: sel,
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
    [c.land, c.capacity, c.identity.home, c.training, c.academy, sel],
  );

  const run = (fn: () => string | undefined | void, ok: string) => notify(fn() ?? ok);
  const propias = c.land.parcels.filter((p) => p.owned).length;
  const libres = c.land.parcels.filter((p) => p.owned && !p.stadium && !p.building).length;
  const porConstruir = KINDS.filter((k) => !isBuilt(s, k));

  return (
    <>
      <Card title="🗺️ Terreno del club" right={<span className="small muted">{propias} de {LAND_SIZE * LAND_SIZE} parcelas</span>}>
        <Suspense fallback={<div className="map3d map3d-error">Cargando mapa 3D…</div>}>
          <Map3D model={model} onSelect={(x, y) => setSel({ x, y })} />
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
              <p className="small muted">
                {c.capacity <= STANDING
                  ? `Todavía no hay gradas: caben ${STANDING} personas de pie alrededor de la valla. Amplía el aforo para construir la primera grada.`
                  : 'Con más aforo, las gradas crecen y aparecen en los demás lados del campo.'}
              </p>
              {c.works ? (
                <p className="hint">🚧 Obras en marcha: +{c.works.amount} asientos, faltan {c.works.matchdaysLeft} jornadas.</p>
              ) : (
                <div className="row wrap">
                  {[250, 1000, 5000].map((n) => (
                    <button
                      key={n}
                      className="btn"
                      disabled={c.cash < stadiumCost(n)}
                      onClick={() => run(() => update((g) => expandStadium(g, n)), 'Obras iniciadas')}
                    >
                      +{n.toLocaleString('es-ES')} asientos · {fmtMoney(stadiumCost(n))}
                    </button>
                  ))}
                </div>
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
                <p className="small muted">Parcela libre. ¿Qué quieres construir?</p>
                {porConstruir.map((k) => (
                  <div key={k} className="facility">
                    <div>
                      <b>{BUILDINGS[k].icon} {BUILDINGS[k].name}</b>
                      <div className="small muted">{BUILDINGS[k].help}</div>
                    </div>
                    <button
                      className="btn small primary"
                      disabled={c.cash < BUILDINGS[k].cost[1]}
                      onClick={() => run(() => update((g) => construct(g, k, parcela.x, parcela.y)), `${BUILDINGS[k].name} construido`)}
                    >
                      {fmtMoney(BUILDINGS[k].cost[1])}
                    </button>
                  </div>
                ))}
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
