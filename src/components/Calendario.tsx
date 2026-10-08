import { ROUND_AFTER, ROUND_NAMES } from '../game/cup';
import type { CupTie } from '../game/cup';
import { MATCHDAYS } from '../game/economy';
import { EURO, EURO_AFTER, EURO_STAGES, myEuroComp } from '../game/europe';
import { myTeam, teamById } from '../game/market';
import { WINDOWS } from '../game/nations';
import { PLAYOFF_NAME, PLAYOFF_ROUNDS } from '../game/playoff';
import type { GameState } from '../game/types';
import { flagOf } from '../game/world';
import { TeamLink } from '../nav/context';
import { Sheet } from '../ui';

interface Fila {
  orden: number; // jornada tras la que se juega (con decimales para los partidos entre semana)
  icono: string;
  comp: string;
  rival?: number;
  casa?: boolean | null; // null = campo neutral
  gf?: number;
  gc?: number;
  extra?: string;
  aviso?: boolean; // parón o mercado: no es un partido
}

/** Calendario de la temporada: nuestros partidos de todas las competiciones, los parones y el mercado */
export default function Calendario({ s, onClose }: { s: GameState; onClose: () => void }) {
  const mio = s.club.teamId;
  const t = myTeam(s);
  const filas: Fila[] = [];
  const deCruce = (tie: CupTie) => {
    const nos = tie.a === mio;
    return {
      rival: nos ? tie.b : tie.a,
      casa: tie.home === null ? null : tie.home === mio,
      gf: tie.ga === undefined ? undefined : nos ? tie.ga : tie.gb,
      gc: tie.gb === undefined ? undefined : nos ? tie.gb : tie.ga,
      extra: tie.agg ? `global ${nos ? tie.agg : tie.agg.split('-').reverse().join('-')}` : tie.pens ? `penaltis ${nos ? tie.pens : tie.pens.split('-').reverse().join('-')}` : undefined,
    };
  };

  // Supercopa, antes de la jornada 1
  const sc = s.supercopa?.season === s.season ? s.supercopa : undefined;
  if (sc && (sc.a === mio || sc.b === mio)) {
    filas.push({ orden: 0.5, icono: '🏅', comp: 'Supercopa', ...deCruce({ a: sc.a, b: sc.b, home: null, ga: sc.ga, gb: sc.gb, pens: sc.pens }) });
  }
  // liga
  (s.fixtures[t.division] ?? []).forEach((jornada, i) => {
    const f = jornada.find((x) => x.home === mio || x.away === mio);
    if (!f) return;
    const casa = f.home === mio;
    filas.push({ orden: i + 1, icono: '⚽', comp: `Jornada ${i + 1}`, rival: casa ? f.away : f.home, casa, gf: casa ? f.hg : f.ag, gc: casa ? f.ag : f.hg });
  });
  // Copa: las rondas en las que hemos estado y, si seguimos vivos, la siguiente
  let vivosCopa = true;
  s.cup.rounds.forEach((ronda, r) => {
    const tie = ronda.find((x) => x.a === mio || x.b === mio);
    if (!tie) return;
    filas.push({ orden: ROUND_AFTER[r] + 0.3, icono: '🏆', comp: `Copa · ${ROUND_NAMES[r]}`, ...deCruce(tie) });
    if (tie.winner !== undefined && tie.winner !== mio) vivosCopa = false;
  });
  const sigCopa = s.cup.rounds.length;
  if (vivosCopa && !s.cup.champion && sigCopa < ROUND_NAMES.length && s.cup.rounds.some((r) => r.some((x) => x.a === mio || x.b === mio))) {
    const ultima = s.cup.rounds[sigCopa - 1].find((x) => x.a === mio || x.b === mio);
    if (ultima?.winner === mio) filas.push({ orden: ROUND_AFTER[sigCopa] + 0.3, icono: '🏆', comp: `Copa · ${ROUND_NAMES[sigCopa]}`, extra: 'rival por sortear' });
  }
  // Europa
  const comp = myEuroComp(s);
  if (comp) {
    const info = EURO[comp.key];
    comp.league.forEach((j, k) => {
      const tie = j.find((x) => x.a === mio || x.b === mio);
      if (tie) filas.push({ orden: EURO_AFTER[k] + 0.6, icono: info.icon, comp: `${info.name} · ${EURO_STAGES[k]}`, ...deCruce(tie) });
    });
    comp.ko.forEach((r, k) => {
      const tie = r.find((x) => x.a === mio || x.b === mio);
      if (tie) filas.push({ orden: EURO_AFTER[4 + k] + 0.6, icono: info.icon, comp: `${info.name} · ${EURO_STAGES[4 + k]}`, ...deCruce(tie) });
    });
    // lo que queda por jugar si seguimos vivos
    const vivo = comp.stage < 4 || comp.ko[comp.ko.length - 1]?.some((x) => x.a === mio || x.b === mio);
    if (vivo) {
      for (let k = Math.max(comp.stage, 4 + comp.ko.length); k < EURO_STAGES.length; k++) {
        filas.push({ orden: EURO_AFTER[k] + 0.6, icono: info.icon, comp: `${info.name} · ${EURO_STAGES[k]}`, extra: k < 4 ? undefined : 'si llegamos' });
      }
    }
  }
  // playoff de ascenso
  const po = s.playoffs?.find((p) => p.division === t.division && p.seeds.includes(mio));
  po?.rounds.forEach((r, k) => {
    const tie = r.find((x) => x.a === mio || x.b === mio);
    if (tie) filas.push({ orden: MATCHDAYS + 0.5 + k / 10, icono: '🔥', comp: `${PLAYOFF_NAME} · ${PLAYOFF_ROUNDS[k]}`, ...deCruce(tie) });
  });
  // parones y mercado
  for (const w of WINDOWS) filas.push({ orden: w + 0.8, icono: '🌍', comp: 'Parón de selecciones', aviso: true });
  filas.push({ orden: 18.9, icono: '🔓', comp: 'Mercado de invierno abierto (jornadas 19-21)', aviso: true });

  filas.sort((a, b) => a.orden - b.orden);
  const proxima = filas.findIndex((f) => !f.aviso && f.gf === undefined);

  return (
    <Sheet title={`📅 Calendario · temporada ${s.season}`} onClose={onClose}>
      <ul className="calendar">
        {filas.map((f, i) => {
          const res = f.gf !== undefined && f.gc !== undefined ? (f.gf > f.gc ? 'win' : f.gf < f.gc ? 'loss' : 'draw') : '';
          const rival = f.rival !== undefined ? teamById(s, f.rival) : undefined;
          return (
            <li key={i} className={`${f.aviso ? 'aviso' : ''} ${i === proxima ? 'next' : ''}`}>
              <span className="cal-ico" aria-hidden>{f.icono}</span>
              <span className="cal-main">
                <small className="muted">{f.comp}</small>
                {rival ? (
                  <span>
                    {f.casa === null ? '🏟️ ' : f.casa ? '🏠 ' : '✈️ '}
                    {rival.country ? `${flagOf(rival.country)} ` : ''}<TeamLink id={rival.id}>{rival.name}</TeamLink>
                    {f.extra && <small className="muted"> · {f.extra}</small>}
                  </span>
                ) : (
                  !f.aviso && <span className="muted">{f.extra ?? 'Por decidir'}</span>
                )}
              </span>
              {res && <b className={`cal-res ${res}`}>{f.gf}-{f.gc}</b>}
              {i === proxima && <span className="cal-next">Próximo</span>}
            </li>
          );
        })}
      </ul>
      <p className="small muted">🏠 en casa · ✈️ fuera · 🏟️ campo neutral. Los partidos de Copa y de Europa se juegan entre jornadas.</p>
    </Sheet>
  );
}
