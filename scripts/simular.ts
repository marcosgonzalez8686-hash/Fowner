// Simula varias temporadas sin interfaz para comprobar que el motor no se rompe y la economía es razonable
import { hireDirector } from '../src/game/director';
import { fmtMoney, ledgerExpense, ledgerIncome } from '../src/game/economy';
import { newGame } from '../src/game/generate';
import { mySquad, myTeam, squadOf, wageBill } from '../src/game/market';
import { endSeason, playMatchday, startSeason } from '../src/game/season';
import { setDelegation } from '../src/game/club';
import type { Task } from '../src/game/types';

const modo = process.argv[2] ?? 'auto'; // auto | manual
const temporadas = Number(process.argv[3] ?? 4);
const s = newGame('CD Pruebas');

if (modo === 'auto') {
  const d = [...s.directorsMarket].sort((a, b) => a.salary - b.salary)[2];
  hireDirector(s, d.id);
  for (const t of ['fichajes', 'ventas', 'renovaciones', 'cantera'] as Task[]) setDelegation(s, t, 'auto');
}

const t0 = Date.now();
for (let temp = 0; temp < temporadas && !s.gameOver; temp++) {
  startSeason(s);
  while (s.phase === 'temporada' && !s.gameOver) playMatchday(s);
  if (s.gameOver) break;
  const l = s.club.ledger;
  console.log(
    `T${s.season} div ${myTeam(s).division} | plantilla ${mySquad(s).length} | salarios ${fmtMoney(wageBill(s))} | ` +
    `ingresos ${fmtMoney(ledgerIncome(l))} gastos ${fmtMoney(ledgerExpense(l))} | caja ${fmtMoney(s.club.cash)} | afición ${myTeam(s).fans}`,
  );
  endSeason(s);
  console.log('  ', s.history.at(-1));
}
console.log('gameOver:', s.gameOver ?? 'no', '| tiempo', Date.now() - t0, 'ms | jugadores', s.players.length);

// comprobaciones de integridad
const tallas = s.teams.map((t) => squadOf(s, t.id).length);
console.log('plantillas min/max', Math.min(...tallas), Math.max(...tallas));
for (let d = 0; d < 5; d++) console.log('div', d, s.teams.filter((t) => t.division === d).length, 'equipos');
console.log('tamaño guardado', Math.round(JSON.stringify(s).length / 1024), 'KB');
console.log('mensajes director:', s.messages.filter((m) => m.from === 'director').slice(0, 8).map((m) => m.title));
