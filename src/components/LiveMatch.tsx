import { useEffect, useMemo, useRef, useState } from 'react';
import { rivalCrest } from '../game/identity';
import { teamById } from '../game/market';
import { STYLES } from '../game/match';
import type { MatchEvent, MatchReport } from '../game/report';
import type { GameState } from '../game/types';
import Crest from './Crest';
import { useBack } from '../nav/back';

// Partido "en directo": repite el informe del motor minuto a minuto con narración.

const FIN = 90;
const VELOCIDAD = { 1: 160, 3: 55 } as const; // ms por minuto

const limpia = (n: string) => n.replace(/\s*\(.*\)$/, '');
const elige = <T,>(lista: T[], semilla: number) => lista[Math.abs(semilla) % lista.length];

function narra(e: MatchEvent, equipo: string, i: number): string {
  const p = limpia(e.player);
  switch (e.type) {
    case 'gol':
      return elige(
        [`¡GOOOL del ${equipo}! ${p} la manda a la red.`, `¡Gol! ${p} no perdona.`, `¡${p} marca para el ${equipo}!`, `¡GOL! Remate de ${p} imposible para el portero.`],
        i,
      ) + (e.assist ? ` Asistencia de ${e.assist}.` : '');
    case 'ocasion':
      if (e.detail === 'parada') return elige([`Disparo de ${p}... ¡paradón del portero!`, `${p} prueba desde fuera del área, el portero atrapa`, `Cabezazo de ${p} que despeja el portero a córner`], i);
      if (e.detail === 'palo') return elige([`¡Al palo! ${p} se queda a centímetros del gol`, `¡Larguero! El disparo de ${p} hace temblar la portería`], i);
      return elige([`${p} remata, pero se va fuera`, `Ocasión de ${p} que se marcha rozando el poste`, `${p} se precipita y la manda a las nubes`], i);
    case 'amarilla':
      return elige([`Tarjeta amarilla para ${p}`, `El árbitro amonesta a ${p} por una entrada fuerte`], i);
    case 'roja':
      return `¡Tarjeta roja para ${p}! El ${equipo} se queda con diez`;
    case 'lesion':
      return `${p} se duele y tiene que ser sustituido. Mala noticia para el ${equipo}`;
  }
}

const ICONO: Record<MatchEvent['type'], string> = { gol: '⚽', ocasion: '🎯', amarilla: '🟨', roja: '🟥', lesion: '🤕' };

export default function LiveMatch({ s, r, onStats, onClose }: { s: GameState; r: MatchReport; onStats: () => void; onClose: () => void }) {
  const [min, setMin] = useState(0);
  // atrás durante el partido: se salta al final y se cierra
  useBack(onClose);
  const [vel, setVel] = useState<1 | 3>(1);
  const feedRef = useRef<HTMLDivElement>(null);
  const home = teamById(s, r.home)!;
  const away = teamById(s, r.away)!;
  const mio = s.club.teamId;
  const crest = (id: number) => (id === mio ? s.club.identity.crest : rivalCrest(id, teamById(s, id)!.short));
  const eventos = useMemo(() => [...r.events].sort((a, b) => a.min - b.min), [r]);

  useEffect(() => {
    if (min >= FIN) return;
    const t = setTimeout(() => setMin((m) => m + 1), VELOCIDAD[vel]);
    return () => clearTimeout(t);
  }, [min, vel]);

  useEffect(() => {
    feedRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [min]);

  const vistos = eventos.filter((e) => e.min <= min);
  const goles = (side: 'home' | 'away') => vistos.filter((e) => e.type === 'gol' && e.side === side).length;
  const tiros = (side: 'home' | 'away') => vistos.filter((e) => (e.type === 'gol' || e.type === 'ocasion') && e.side === side).length;
  const tarjetas = (side: 'home' | 'away') => vistos.filter((e) => (e.type === 'amarilla' || e.type === 'roja') && e.side === side).length;
  const terminado = min >= FIN;
  const nombre = (side: 'home' | 'away') => (side === 'home' ? home.name : away.name);

  // narración: lo más reciente arriba
  const lineas: { min: number; icon: string; text: string; side?: 'home' | 'away'; gol?: boolean }[] = [
    { min: 0, icon: '📣', text: `¡Arranca el partido! ${home.name} contra ${away.name}.` },
  ];
  if (r.plans) {
    lineas.push({
      min: 0,
      icon: '📋',
      text: `${home.short} sale con ${r.plans.home.formation} (${STYLES[r.plans.home.style].label.toLowerCase()}); ${away.short}, con ${r.plans.away.formation} (${STYLES[r.plans.away.style].label.toLowerCase()}).`,
    });
  }
  vistos.forEach((e, i) => lineas.push({ min: e.min, icon: ICONO[e.type], text: narra(e, nombre(e.side), i + e.min), side: e.side, gol: e.type === 'gol' }));
  if (min >= 45) {
    const gH = eventos.filter((e) => e.type === 'gol' && e.side === 'home' && e.min <= 45).length;
    const gA = eventos.filter((e) => e.type === 'gol' && e.side === 'away' && e.min <= 45).length;
    lineas.push({ min: 45, icon: '⏸️', text: `Descanso: ${home.short} ${gH} - ${gA} ${away.short}.` });
  }
  if (terminado) {
    lineas.push({ min: 90, icon: '🏁', text: `¡Final del partido! ${home.name} ${r.hg} - ${r.ag} ${away.name}.` });
    if (r.pens) lineas.push({ min: 90, icon: '🥅', text: `Penaltis: ${home.short} ${r.pens.replace('-', ' - ')} ${away.short}.` });
  }
  lineas.sort((a, b) => b.min - a.min);

  return (
    <div className="overlay live" role="dialog" aria-label="Partido en directo">
      <div className="overlay-inner">
        <div className="live-head">
          <span className="live-label">{terminado ? 'FINAL' : <><i className="dot-live" /> EN DIRECTO</>}</span>
          <span className="small muted">{r.label ?? `Jornada ${r.matchday}`}</span>
        </div>

        <div className="scoreboard live-score">
          <div className={r.home === mio ? 'me' : ''}>
            <Crest c={crest(r.home)} size={46} />
            <span>{home.name}</span>
          </div>
          <div className="big-score">
            {goles('home')} - {goles('away')}
            <small className="clock">{terminado ? (r.pens ? `pen. ${r.pens}` : "90'") : `${min}'`}</small>
          </div>
          <div className={r.away === mio ? 'me' : ''}>
            <Crest c={crest(r.away)} size={46} />
            <span>{away.name}</span>
          </div>
        </div>

        <div className="progress" aria-hidden>
          <i style={{ width: `${(min / FIN) * 100}%` }} />
        </div>

        <div className="live-stats">
          <span>{tiros('home')}</span><small>Tiros</small><span>{tiros('away')}</span>
          <span>{r.stats.home.possession}%</span><small>Posesión</small><span>{r.stats.away.possession}%</span>
          <span>{tarjetas('home')}</span><small>Tarjetas</small><span>{tarjetas('away')}</span>
        </div>

        <div className="feed" ref={feedRef}>
          {lineas.map((l, i) => (
            <div key={i} className={`feed-line${l.gol ? ' gol' : ''}${l.side ? ` ${l.side}` : ''}`}>
              <span className="min">{l.min}'</span>
              <span>{l.icon} {l.text}</span>
            </div>
          ))}
        </div>

        <div className="overlay-actions">
          {!terminado ? (
            <div className="row">
              <button className="btn grow" onClick={() => setVel(vel === 1 ? 3 : 1)}>{vel === 1 ? '⏩ ×3' : '▶ ×1'}</button>
              <button className="btn grow" onClick={() => setMin(FIN)}>⏭ Ir al final</button>
            </div>
          ) : (
            <div className="row">
              <button className="btn grow" onClick={onStats}>📊 Estadísticas</button>
              <button className="btn primary grow" onClick={onClose}>Continuar</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
