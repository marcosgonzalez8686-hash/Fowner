import { useState } from 'react';
import type { ScreenProps } from '../App';
import Crest from '../components/Crest';
import { CUP_NAME, ROUND_AFTER, ROUND_NAMES, ROUND_PRIZE, myTie } from '../game/cup';
import { fmtMoney } from '../game/economy';
import { rivalCrest } from '../game/identity';
import { teamById } from '../game/market';
import type { GameState } from '../game/types';
import { Card } from '../ui';
import { CONT_AFTER, CONT_ENTRY, CONT_NAME, CONT_PRIZE, CONT_ROUNDS, FLAG, SUPER_NAME, SUPER_PRIZE } from '../game/continental';
import type { CupTie } from '../game/cup';

function Cruce({ s, t, mine }: { s: GameState; t: CupTie; mine?: boolean }) {
  return (
    <div className={`cup-tie${mine ? ' mine' : ''}`}>
      <Equipo s={s} id={t.a} ganador={t.winner} />
      <span className="cup-score">
        {t.ga !== undefined ? `${t.ga} - ${t.gb}` : t.home === null ? 'neutral' : 'vs'}
        {t.pens && <small>pen. {t.pens}</small>}
      </span>
      <Equipo s={s} id={t.b} ganador={t.winner} />
    </div>
  );
}

/** Supercopa y Copa de Campeones de esta temporada */
function OtrasCompeticiones({ s }: { s: GameState }) {
  const mio = s.club.teamId;
  const sc = s.supercopa?.season === s.season ? s.supercopa : undefined;
  const c = s.continental?.season === s.season ? s.continental : undefined;
  return (
    <>
      {sc && (
        <Card title={`🏅 ${SUPER_NAME} · temporada ${s.season}`}>
          <Cruce s={s} t={{ a: sc.a, b: sc.b, home: null, ga: sc.ga, gb: sc.gb, pens: sc.pens, winner: sc.winner }} mine={sc.a === mio || sc.b === mio} />
          <p className="small muted">
            Campeón de Liga de Primera contra campeón de Copa, antes de la jornada 1 y en campo neutral. Premio: {fmtMoney(SUPER_PRIZE.win)} (subcampeón {fmtMoney(SUPER_PRIZE.lose)}).
            ¡Ganar la Copa desde cualquier categoría te mete en ella!
          </p>
        </Card>
      )}
      {c ? (
        <Card title={`🌍 ${CONT_NAME} · temporada ${s.season}`}>
          <p className="small muted">
            16 clubes de Europa a partido único. Participar: {fmtMoney(CONT_ENTRY)}; pasar cada ronda:{' '}
            {CONT_PRIZE.map((x) => fmtMoney(x)).join(' / ')}.
          </p>
          {[...c.rounds].map((r, i) => ({ r, i })).reverse().map(({ r, i }) => (
            <div key={i}>
              <h4>{CONT_ROUNDS[i]} · tras la jornada {CONT_AFTER[i]}</h4>
              {[...r].sort((x, y) => Number(y.a === mio || y.b === mio) - Number(x.a === mio || x.b === mio)).map((t, j) => (
                <Cruce key={j} s={s} t={t} mine={t.a === mio || t.b === mio} />
              ))}
            </div>
          ))}
          {c.champion !== undefined && <p><b>Campeón: {teamById(s, c.champion)?.name}</b></p>}
        </Card>
      ) : (
        <p className="small muted center">🌍 Los 4 primeros de Primera juegan la {CONT_NAME} la temporada siguiente.</p>
      )}
    </>
  );
}

function Equipo({ s, id, ganador }: { s: GameState; id: number; ganador?: number }) {
  const t = teamById(s, id)!;
  const mio = id === s.club.teamId;
  return (
    <span className={`cup-team${mio ? ' me' : ''}${ganador !== undefined && ganador !== id ? ' out' : ''}`}>
      <Crest c={mio ? s.club.identity.crest : rivalCrest(t.id, t.short)} size={18} />
      <span className="cup-name">{t.name}</span>
      <small>{t.country ? FLAG[t.country] : `${t.division + 1}ª`}</small>
    </span>
  );
}

export default function Copa({ s }: ScreenProps) {
  const cup = s.cup;
  const ultima = cup.rounds.length - 1;
  const [ronda, setRonda] = useState(ultima);
  const mio = s.club.teamId;

  // trayectoria de nuestro club
  let estado: string;
  const eliminadoEn = cup.rounds.findIndex((r) => r.some((t) => (t.a === mio || t.b === mio) && t.winner !== undefined && t.winner !== mio));
  if (cup.champion === mio) estado = '🏆 ¡Campeones de Copa!';
  else if (eliminadoEn >= 0) estado = `Eliminados en ${ROUND_NAMES[eliminadoEn].toLowerCase()}`;
  else if (myTie(s)) estado = `En ${ROUND_NAMES[cup.current].toLowerCase()} · se juega tras la jornada ${ROUND_AFTER[cup.current]}`;
  else estado = 'Sin participación';

  const ties = cup.rounds[ronda] ?? [];
  const nuestra = ties.find((t) => t.a === mio || t.b === mio);
  const resto = ties.filter((t) => t !== nuestra);

  return (
    <>
      <OtrasCompeticiones s={s} />
      <Card title={`🏆 ${CUP_NAME} · temporada ${s.season}`}>
        <p><b>{estado}</b></p>
        {cup.champion !== undefined && cup.champion !== mio && (
          <p className="small muted">Campeón: {teamById(s, cup.champion)!.name}</p>
        )}
        <p className="small muted">
          64 equipos, eliminatoria a partido único. Juega en casa el de menor categoría y la final es en campo neutral.
          Si hay empate, penaltis.
        </p>
        <details>
          <summary>Premios por ronda</summary>
          <table className="table money">
            <tbody>
              {ROUND_NAMES.map((n, i) => (
                <tr key={n}>
                  <td className="left">{i === ROUND_NAMES.length - 1 ? 'Ganar la final' : `Pasar ${n.toLowerCase()}`}</td>
                  <td>{fmtMoney(ROUND_PRIZE[i])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </Card>

      <div className="chips">
        {cup.rounds.map((_, i) => (
          <button key={i} className={i === ronda ? 'on' : ''} onClick={() => setRonda(i)}>
            {ROUND_NAMES[i]}
          </button>
        ))}
      </div>

      <Card title={`${ROUND_NAMES[ronda]} · tras la jornada ${ROUND_AFTER[ronda]}`}>
        {[...(nuestra ? [nuestra] : []), ...resto].map((t, i) => (
          <div key={i} className={`cup-tie${t === nuestra ? ' mine' : ''}`}>
            <Equipo s={s} id={t.a} ganador={t.winner} />
            <span className="cup-score">
              {t.ga !== undefined ? `${t.ga} - ${t.gb}` : t.home === null ? 'neutral' : 'vs'}
              {t.pens && <small>pen. {t.pens}</small>}
            </span>
            <Equipo s={s} id={t.b} ganador={t.winner} />
          </div>
        ))}
      </Card>

      {s.club.trophies.length > 0 && (
        <Card title="🏅 Palmarés">
          {s.club.trophies.map((x, i) => (
            <p key={i}>🏆 {x.name} · temporada {x.season}</p>
          ))}
        </Card>
      )}
    </>
  );
}
