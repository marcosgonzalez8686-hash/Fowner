import { useState } from 'react';
import type { ScreenProps } from '../App';
import { levelOf } from '../game/director';
import { DIV_LEVEL, fmtMoney, roundMoney } from '../game/economy';
import {
  marketOpen, myTeam, mySquad, myYouth, promoteYouth, releasePlayer, renewPlayer, renewSalary, sellPlayer, sellPrice,
  wageBill,
} from '../game/market';
import { FORMACION } from '../game/match';
import { coachOf, ourPlan, ourShape, tacticsLabel } from '../game/coach';
import type { Player, Pos } from '../game/types';
import { Card, Ovr, Segmented, Sheet } from '../ui';
import { moraleLabel } from '../game/morale';
import { seasonAverage } from '../game/history';
import { FormStrip, RatingBadge } from '../components/Rating';

const POS_NAME: Record<Pos, string> = { POR: 'Porteros', DEF: 'Defensas', MED: 'Centrocampistas', DEL: 'Delanteros' };

export default function Plantilla({ s, update, notify }: ScreenProps) {
  const [sel, setSel] = useState<Player | null>(null);
  const [anos, setAnos] = useState('2');
  const squad = mySquad(s);
  const youth = myYouth(s);
  const nivel = DIV_LEVEL[myTeam(s).division];
  const { xi, strength, formation, style } = ourPlan(s, squad);
  const forma = ourShape(s);
  const faltan = (Object.keys(forma) as Pos[]).filter((pos) => squad.filter((p) => p.pos === pos && !p.youth).length < forma[pos]);
  const titulares = new Set(xi.map((p) => p.id));

  const run = (fn: () => string | undefined | void, ok: string) => {
    const err = fn();
    notify(err ?? ok);
    setSel(null);
  };

  return (
    <>
      <Card>
        <div className="kpis">
          <div><b>{squad.length}</b><span>jugadores</span></div>
          <div><b>{strength.toFixed(1)}</b><span>media del once</span></div>
          <div><b>{nivel}</b><span>media de la liga</span></div>
          <div><b>{fmtMoney(wageBill(s))}</b><span>salarios/temp.</span></div>
          <div><b>{moraleLabel(s.club.morale).emoji} {s.club.morale}</b><span>moral del vestuario</span></div>
          <div><b>{squad.filter((p) => (p.injury ?? 0) > 0).length}</b><span>lesionados</span></div>
        </div>
        <p className="small">
          🧢 <b>{tacticsLabel(formation, style)}</b>
          <span className="muted"> · {coachOf(s) ? `el sistema de ${coachOf(s)!.name}` : 'sin entrenador, el capitán tira de lo clásico'}</span>
        </p>
        {faltan.length > 0 && (
          <p className="hint warn-bg small">
            ⚠️ Para su {formation} faltan jugadores en: {faltan.map((pos) => POS_NAME[pos].toLowerCase()).join(', ')}. Juegan fuera de posición y rinden menos.
          </p>
        )}
        <p className="small muted">⭐ titular · 🤕 lesionado (no juega hasta recuperarse)</p>
      </Card>

      {youth.length > 0 && (
        <Card title="🌱 Juveniles de la cantera">
          <p className="muted small">
            {levelOf(s, 'cantera') === 'manual'
              ? 'Decide a quién subes. Los que no subas antes de la jornada 1 se marcharán.'
              : 'El director deportivo se encarga, pero puedes decidir tú.'}
          </p>
          {youth.map((p) => (
            <div key={p.id} className="player">
              <span className="pos">{p.pos}</span>
              <span className="name">{p.name}<small>{p.age} años · potencial {p.pot}</small></span>
              <Ovr v={p.ovr} base={nivel} />
              <button className="btn small primary" onClick={() => run(() => update((g) => promoteYouth(g, p.id).error), `${p.name} sube al primer equipo`)}>Subir</button>
              <button className="btn small" onClick={() => run(() => update((g) => releasePlayer(g, p.id).error), `${p.name} se marcha`)}>✕</button>
            </div>
          ))}
        </Card>
      )}

      {(Object.keys(FORMACION) as Pos[]).map((pos) => (
        <Card key={pos} title={`${POS_NAME[pos]} · ${forma[pos]} en el once`}>
          {squad
            .filter((p) => p.pos === pos)
            .sort((a, b) => b.ovr - a.ovr)
            .map((p) => (
              <button key={p.id} className="player as-btn" onClick={() => { setSel(p); setAnos(p.age >= 31 ? '1' : '2'); }}>
                <span className="pos">{(p.injury ?? 0) > 0 ? '🤕' : titulares.has(p.id) ? '⭐' : ''}</span>
                <span className="name">
                  {p.name}
                  <small>
                    {(p.injury ?? 0) > 0 && <b className="neg">Lesionado {p.injury} j. · </b>}
                    {p.age} años · {fmtMoney(p.salary)} · {p.contract <= 1 ? <b className="warn">acaba contrato</b> : `${p.contract} temp.`}
                  </small>
                  {p.form?.length ? (
                    <small className="form-line">
                      <FormStrip form={p.form} />
                      {p.season?.apps ? <span className="muted"> · {p.season.apps} PJ{p.season.goals ? ` · ${p.season.goals} ⚽` : ''}</span> : null}
                    </small>
                  ) : null}
                </span>
                <Ovr v={p.ovr} base={nivel} />
              </button>
            ))}
        </Card>
      ))}

      {sel && (
        <Sheet title={sel.name} onClose={() => setSel(null)}>
          <p className="muted">
            {sel.pos} · {sel.age} años · media {sel.ovr} · potencial {sel.pot}
            <br />
            Cobra {fmtMoney(sel.salary)}/temp. · contrato: {sel.contract} temp.
          </p>

          <h4>Esta temporada</h4>
          {sel.season?.apps ? (
            <>
              <div className="kpis">
                <div><b>{sel.season.apps}</b><span>partidos</span></div>
                <div><b>{sel.season.goals}</b><span>goles</span></div>
                <div><b>{sel.season.assists}</b><span>asistencias</span></div>
                <div><b><RatingBadge v={seasonAverage(sel)!} /></b><span>nota media</span></div>
              </div>
              <p className="small">Últimas notas: <FormStrip form={sel.form} /></p>
            </>
          ) : (
            <p className="small muted">Aún no ha jugado esta temporada.</p>
          )}

          <h4>Renovar</h4>
          <p className="small">Pide {fmtMoney(renewSalary(sel))}/temp.</p>
          <Segmented
            value={anos}
            onChange={setAnos}
            options={['1', '2', '3', '4'].map((v) => ({ value: v, label: `${v} año${v === '1' ? '' : 's'}` }))}
          />
          <button
            className="btn primary full"
            onClick={() => run(() => update((g) => renewPlayer(g, sel.id, renewSalary(sel), Number(anos)).error), 'Renovado')}
          >
            Renovar
          </button>

          <h4>Vender</h4>
          {marketOpen(s) ? (
            <button
              className="btn full"
              onClick={() => run(() => update((g) => sellPlayer(g, sel.id, sellPrice(sel)).error), `Vendido por ${fmtMoney(sellPrice(sel))}`)}
            >
              Aceptar oferta de {fmtMoney(sellPrice(sel))}
            </button>
          ) : (
            <p className="small muted">El mercado está cerrado.</p>
          )}

          <h4>Rescindir</h4>
          <button
            className="btn danger full"
            onClick={() => run(() => update((g) => releasePlayer(g, sel.id).error), `${sel.name} queda libre`)}
          >
            Rescindir (cuesta {fmtMoney(roundMoney((sel.salary * Math.max(sel.contract, 1)) / 2))})
          </button>
        </Sheet>
      )}
    </>
  );
}
