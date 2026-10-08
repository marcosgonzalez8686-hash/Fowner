// Simula varias temporadas sin interfaz para comprobar que el motor no se rompe y la economía es razonable
import { hireDirector, renewDirector } from '../src/game/director';
import { fmtMoney, ledgerExpense, ledgerIncome } from '../src/game/economy';
import { newGame } from '../src/game/generate';
import { mySquad, myTeam, squadOf, wageBill } from '../src/game/market';
import { advanceWeek, endSeason, playMatchday, startSeason } from '../src/game/season';
import { myPlayoffDue, playPlayoffRound } from '../src/game/playoff';
import { setDelegation } from '../src/game/club';
import type { Task } from '../src/game/types';
import { signOffer, type SponsorSlot } from '../src/game/sponsor';
import { hireStaff } from '../src/game/staff';
import { resolveEvent } from '../src/game/events';
import { expectedObjective, setObjective } from '../src/game/fans';
import { myCupMatchDue, playCupRound, ROUND_NAMES } from '../src/game/cup';

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
  // la pretemporada pasa semana a semana: así avanzan las negociaciones
  while (!advanceWeek(s));
  startSeason(s);
  while (s.phase === 'temporada' && !s.gameOver) {
    if (myCupMatchDue(s)) playCupRound(s);
    playMatchday(s);
    if (s.pendingEvent) resolveEvent(s, 0);
  }
  if (s.gameOver) break;
  const l = s.club.ledger;
  console.log(
    `T${s.season} div ${myTeam(s).division} | plantilla ${mySquad(s).length} | salarios ${fmtMoney(wageBill(s))} | ` +
    `ingresos ${fmtMoney(ledgerIncome(l))} gastos ${fmtMoney(ledgerExpense(l))} | caja ${fmtMoney(s.club.cash)} | afición ${myTeam(s).fans} | satisf ${s.club.satisfaction} moral ${s.club.morale} | lesionados ${mySquad(s).filter((p) => (p.injury ?? 0) > 0).length}`,
  );
  const copa = s.cup.rounds.findIndex((r) => r.some((t) => (t.a === s.club.teamId || t.b === s.club.teamId) && t.winner !== s.club.teamId));
  console.log('   copa:', copa === -1 ? 'CAMPEÓN' : `eliminado en ${ROUND_NAMES[copa]}`, '| campeón', s.teams.find((t) => t.id === s.cup.champion)?.name, '| premios', s.club.ledger.copa);
  const ent = s.club.staff.entrenador;
  console.log('   entrenador:', ent ? `${ent.name} ${ent.stars}★ ${ent.formation} ${ent.style} · contrato ${ent.contract} · confianza ${ent.confidence}` : 'ninguno');
  const negs = s.negotiations.filter((n) => n.season === s.season);
  console.log('   negociaciones:', negs.length, '| cerradas', negs.filter((n) => n.state === 'cerrada').length, '| rotas', negs.filter((n) => n.state === 'rota').length, '| tipos', [...new Set(negs.map((n) => n.kind))].join(','));
  // un dueño atento renueva al director cuando le toca
  if ((s.club.director?.contract ?? 2) <= 1) renewDirector(s);
  while (myPlayoffDue(s)) {
    playPlayoffRound(s);
    console.log('   playoff:', s.messages[0].title);
  }
  endSeason(s);
  // firma la oferta intermedia de cada espacio libre
  for (const [slot, ofertas] of Object.entries(s.sponsorOffers)) if (ofertas?.length) signOffer(s, slot as SponsorSlot, ofertas[1].id);
  console.log('  ', s.history.at(-1));
}
console.log('gameOver:', s.gameOver ?? 'no', '| tiempo', Date.now() - t0, 'ms | jugadores', s.players.length);

// comprobaciones de integridad
const tallas = s.teams.map((t) => squadOf(s, t.id).length);
console.log('equipos por categoría', [0, 1, 2, 3, 4].map((d) => s.teams.filter((t) => t.division === d).length).join('/'));
console.log('plantillas min/max', Math.min(...tallas), Math.max(...tallas));
for (let d = 0; d < 5; d++) console.log('div', d, s.teams.filter((t) => t.division === d).length, 'equipos');
console.log('tamaño guardado', Math.round(JSON.stringify(s).length / 1024), 'KB');
console.log('mensajes director:', s.messages.filter((m) => m.from === 'director').slice(0, 8).map((m) => m.title));
