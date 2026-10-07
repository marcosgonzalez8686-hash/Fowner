import { useState } from 'react';
import type { ScreenProps } from '../App';
import Crest from '../components/Crest';
import { CUP_NAME, ROUND_AFTER, ROUND_NAMES, ROUND_PRIZE, myTie } from '../game/cup';
import { fmtMoney } from '../game/economy';
import { rivalCrest } from '../game/identity';
import { teamById } from '../game/market';
import type { GameState } from '../game/types';
import { Card } from '../ui';

function Equipo({ s, id, ganador }: { s: GameState; id: number; ganador?: number }) {
  const t = teamById(s, id)!;
  const mio = id === s.club.teamId;
  return (
    <span className={`cup-team${mio ? ' me' : ''}${ganador !== undefined && ganador !== id ? ' out' : ''}`}>
      <Crest c={mio ? s.club.identity.crest : rivalCrest(t.id, t.short)} size={18} />
      <span className="cup-name">{t.name}</span>
      <small>{t.division + 1}ª</small>
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
