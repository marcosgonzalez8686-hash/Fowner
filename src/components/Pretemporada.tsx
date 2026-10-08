import { useState } from 'react';
import type { ReactNode } from 'react';
import type { TabId, Update } from '../App';
import { fmtMoney } from '../game/economy';
import { OBJECTIVES, objectiveReaction } from '../game/fans';
import { myYouth, mySquad } from '../game/market';
import { PRE_WEEKS } from '../game/negotiation';
import { advanceWeek, startSeason } from '../game/season';
import { hireStaff } from '../game/staff';
import { tacticsLabel } from '../game/coach';
import { levelOf } from '../game/director';
import { seasonTicketForecast } from '../game/tickets';
import type { GameState } from '../game/types';
import { Stars } from '../ui';
import { SlotOffers } from './Sponsors';
import { ObjectivePicker } from './FansCard';

type PasoId = 'camiseta' | 'objetivo' | 'entrenador';
interface Paso {
  id: PasoId;
  titulo: string;
  hecho: boolean;
  resumen: ReactNode; // línea compacta cuando ya está hecho
}

/** Pretemporada guiada: una decisión cada vez (patrocinador → objetivo → entrenador) y después, lo opcional */
export default function Pretemporada({ s, update, notify, go }: {
  s: GameState;
  update: Update;
  notify: (m: string) => void;
  go: (tab: TabId, sub?: string) => void;
}) {
  const [editar, setEditar] = useState<PasoId | null>(null);
  const camiseta = s.club.sponsors.camiseta;
  const coach = s.club.staff.entrenador;
  const candidatos = [...(s.staffMarket.entrenador ?? [])].sort((a, b) => b.stars - a.stars || a.salary - b.salary);
  const reaccion = objectiveReaction(s);

  const pasos: Paso[] = [];
  if (camiseta || s.sponsorOffers.camiseta?.length) {
    pasos.push({
      id: 'camiseta',
      titulo: 'Elige patrocinador de camiseta',
      hecho: Boolean(camiseta),
      resumen: camiseta && <>👕 <b>{camiseta.name}</b> · {fmtMoney(camiseta.annual)}/temp.</>,
    });
  }
  pasos.push({
    id: 'objetivo',
    titulo: 'Anuncia el objetivo de la temporada',
    hecho: Boolean(s.club.objective),
    resumen: s.club.objective && (
      <>
        {OBJECTIVES[s.club.objective].icon} <b>{OBJECTIVES[s.club.objective].label}</b>
        {reaccion && <span className="muted"> · {reaccion.emoji} {reaccion.text}</span>}
      </>
    ),
  });
  pasos.push({
    id: 'entrenador',
    titulo: 'Contrata a tu entrenador',
    hecho: Boolean(coach) || s.skipCoach === s.season || candidatos.length === 0,
    resumen: coach ? <>🧢 <b>{coach.name}</b> · {coach.formation && coach.style ? tacticsLabel(coach.formation, coach.style) : ''}</> : <>🧢 Sin entrenador</>,
  });

  const actual = editar ? pasos.find((p) => p.id === editar) : pasos.find((p) => !p.hecho);
  const indice = actual ? pasos.indexOf(actual) : pasos.length;
  const falta = [
    !camiseta && s.sponsorOffers.camiseta?.length ? 'patrocinador' : null,
    !s.club.objective ? 'objetivo' : null,
  ].filter(Boolean) as string[];

  const plantilla = mySquad(s);
  const juveniles = myYouth(s).length;
  const sugerencias: { texto: string; ir: () => void }[] = [
    // si la cantera la lleva el director, no se pide nada al dueño
    ...(juveniles && levelOf(s, 'cantera') === 'manual' ? [{ texto: `🌱 Decide qué hacer con ${juveniles} juvenil${juveniles > 1 ? 'es' : ''} de la cantera`, ir: () => go('equipo', 'plantilla') }] : []),
    ...(plantilla.length < 18 ? [{ texto: `⚠️ Plantilla corta (${plantilla.length}): ficha en el mercado`, ir: () => go('equipo', 'mercado') }] : []),
    { texto: `🎟️ Campaña de abonos: ~${seasonTicketForecast(s).toLocaleString('es-ES')} abonos a ${fmtMoney(s.club.seasonTickets.price)}`, ir: () => go('finanzas', 'entradas') },
    ...(s.club.director ? [] : [{ texto: '💼 Contrata un director deportivo (opcional)', ir: () => go('direccion', 'director') }]),
    { texto: '🔁 Mira el mercado de fichajes', ir: () => go('equipo', 'mercado') },
  ];

  const contenido = (id: PasoId) => {
    if (id === 'camiseta') {
      return (
        <>
          <p className="small muted">Tres empresas quieren poner su nombre en tu camiseta. Es dinero fijo cada temporada.</p>
          <SlotOffers s={s} slot="camiseta" update={update} notify={notify} />
        </>
      );
    }
    if (id === 'objetivo') return <ObjectivePicker s={s} update={update} notify={(m) => { notify(m); setEditar(null); }} />;
    return (
      <>
        <p className="small muted">Él elige el once y juega con su sistema. Sin entrenador, el equipo rinde peor.</p>
        {candidatos.slice(0, 3).map((c) => (
          <div key={c.id} className="dd">
            <div>
              <b>{c.name}</b> <Stars n={c.stars} />
              <div className="small muted">{c.trait} · {fmtMoney(c.salary)}/temp.</div>
              {c.formation && c.style && <div className="small">🧢 {tacticsLabel(c.formation, c.style)}</div>}
            </div>
            <button
              className="btn small primary"
              onClick={() => {
                const err = update((g) => hireStaff(g, 'entrenador', c.id));
                notify(err ?? `${c.name}, nuevo entrenador`);
                setEditar(null);
              }}
            >
              Contratar
            </button>
          </div>
        ))}
        <div className="row mt">
          <button className="btn small grow" onClick={() => go('direccion', 'empleados')}>Ver todos ›</button>
          {!coach && (
            <button className="btn small grow" onClick={() => { update((g) => { g.skipCoach = g.season; }); setEditar(null); }}>
              Seguir sin entrenador
            </button>
          )}
        </div>
      </>
    );
  };

  return (
    <>
      <h2>Pretemporada {s.season}</h2>
      <p className="muted small">Semana {(s.preWeek ?? 0) + 1} de {PRE_WEEKS} · mercado abierto</p>

      <div className="stepbar" aria-hidden>
        {pasos.map((p, i) => <i key={p.id} className={p.hecho ? 'on' : i === indice ? 'now' : ''} />)}
      </div>

      {/* lo ya decidido, en una línea cada cosa */}
      {pasos.some((p) => p.hecho && p !== actual) && (
        <ul className="done-steps">
          {pasos.filter((p) => p.hecho && p !== actual).map((p) => (
            <li key={p.id}>
              <span>✅ {p.resumen}</span>
              {p.id === 'objetivo' && <button className="link" onClick={() => setEditar('objetivo')}>Cambiar</button>}
              {p.id === 'entrenador' && <button className="link" onClick={() => setEditar('entrenador')}>{coach ? 'Cambiar' : 'Contratar'}</button>}
            </li>
          ))}
        </ul>
      )}

      {actual ? (
        <div className="step-now">
          <span className="step-label">{editar ? 'Cambiando' : `Paso ${indice + 1} de ${pasos.length}`}</span>
          <h3>{actual.titulo}</h3>
          {contenido(actual.id)}
          {editar && <button className="btn full mt" onClick={() => setEditar(null)}>Volver</button>}
        </div>
      ) : (
        <>
          <p className="small"><b>Todo listo para empezar.</b> Si quieres, antes puedes:</p>
          <ul className="suggest">
            {sugerencias.map((x) => (
              <li key={x.texto}><button className="link" onClick={x.ir}>{x.texto} ›</button></li>
            ))}
          </ul>
        </>
      )}

      {!actual && (s.preWeek ?? 0) < PRE_WEEKS - 1 && (
        <button
          className="btn big full"
          onClick={() => {
            const err = update((g) => advanceWeek(g));
            notify(err ?? 'Pasa una semana de pretemporada');
          }}
        >
          ⏩ Avanzar una semana
        </button>
      )}
      <button
        className="btn primary big full"
        disabled={falta.length > 0}
        onClick={() => {
          const err = update((g) => startSeason(g));
          if (err) notify(err);
        }}
      >
        Empezar temporada
      </button>
      {falta.length > 0 && <p className="small muted center">Falta: {falta.join(' y ')}</p>}
    </>
  );
}
