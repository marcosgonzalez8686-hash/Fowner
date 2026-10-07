// Simula varias temporadas sin interfaz para comprobar que el motor no se rompe y la economía es razonable
import { hireDirector } from '../src/game/director';
import { fmtMoney, ledgerExpense, ledgerIncome } from '../src/game/economy';
import { newGame } from '../src/game/generate';
import { mySquad, myTeam, squadOf, wageBill } from '../src/game/market';
import { endSeason, playMatchday, startSeason } from '../src/game/season';
import { setDelegation } from '../src/game/club';
import type { Task } from '../src/game/types';
import { signOffer, type SponsorSlot } from '../src/game/sponsor';
import { hireStaff } from '../src/game/staff';
import { resolveEvent } from '../src/game/events';
import { expectedObjective, setObjective } from '../src/game/fans';

const modo = process.argv[2] ?? 'auto'; // auto | manual
const temporadas = Number(process.argv[3] ?? 4);
const s = newGame('CD Pruebas');
// patrocinador fijo y un entrenador de nivel medio para que la simulación sea realista
signOffer(s, 'camiseta', s.sponsorOffers.camiseta![0].id);
hireStaff(s, 'entrenador', s.staffMarket.entrenador[1].id);

if (modo === 'auto') {
  const d = [...s.directorsMarket].sort((a, b) => a.salary - b.salary)[2];
  hireDirector(s, d.id);
  for (const t of ['fichajes', 'ventas', 'renovaciones', 'cantera'] as Task[]) setDelegation(s, t, 'auto');
}

const t0 = Date.now();
for (let temp = 0; temp < temporadas && !s.gameOver; temp++) {
  setObjective(s, expectedObjective(s));
  startSeason(s);
  while (s.phase === 'temporada' && !s.gameOver) {
    playMatchday(s);
    if (s.pendingEvent) resolveEvent(s, 0);
  }
  if (s.gameOver) break;
  const l = s.club.ledger;
  console.log(
    `T${s.season} div ${myTeam(s).division} | plantilla ${mySquad(s).length} | salarios ${fmtMoney(wageBill(s))} | ` +
    `ingresos ${fmtMoney(ledgerIncome(l))} gastos ${fmtMoney(ledgerExpense(l))} | caja ${fmtMoney(s.club.cash)} | afición ${myTeam(s).fans} | satisf ${s.club.satisfaction} moral ${s.club.morale} | lesionados ${mySquad(s).filter((p) => (p.injury ?? 0) > 0).length}`,
  );
  endSeason(s);
  // firma la oferta intermedia de cada espacio libre
  for (const [slot, ofertas] of Object.entries(s.sponsorOffers)) if (ofertas?.length) signOffer(s, slot as SponsorSlot, ofertas[1].id);
  console.log('  ', s.history.at(-1));
}
console.log('gameOver:', s.gameOver ?? 'no', '| tiempo', Date.now() - t0, 'ms | jugadores', s.players.length);

// comprobaciones de integridad
const tallas = s.teams.map((t) => squadOf(s, t.id).length);
console.log('plantillas min/max', Math.min(...tallas), Math.max(...tallas));
for (let d = 0; d < 5; d++) console.log('div', d, s.teams.filter((t) => t.division === d).length, 'equipos');
console.log('tamaño guardado', Math.round(JSON.stringify(s).length / 1024), 'KB');
console.log('mensajes director:', s.messages.filter((m) => m.from === 'director').slice(0, 8).map((m) => m.title));
