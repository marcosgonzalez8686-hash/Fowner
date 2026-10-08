import { DIV_SPONSOR, fmtMoney, roundMoney } from './economy';
import { potLabel } from './scouting';
import { makePlayer } from './generate';
import { addMessage, myTeam, mySquad } from './market';
import { chance, pick, randInt } from './rng';
import type { GameState } from './types';
import { changeSatisfaction } from './fans';
import { changeMorale } from './morale';

// Eventos entre semana: de vez en cuando pasa algo y el dueño tiene que decidir

export interface EventOption {
  label: string;
  hint: string; // qué va a pasar, en pocas palabras
}

export interface PendingEvent {
  id: number;
  key: string;
  icon: string;
  title: string;
  body: string;
  options: EventOption[];
  data: Record<string, number | string>;
}

interface Template {
  key: string;
  icon: string;
  /** devuelve null si el evento no tiene sentido ahora */
  create: (s: GameState, escala: number) => Omit<PendingEvent, 'id' | 'key' | 'icon'> | null;
  apply: (s: GameState, opcion: number, data: PendingEvent['data']) => string;
}

const caja = (s: GameState, v: number, linea: 'comercial' | 'obras' | 'personal' = 'comercial') => {
  s.club.cash += v;
  if (v >= 0) s.club.ledger.comercial += v;
  else s.club.ledger[linea] += -v;
};
const aficion = (s: GameState, pct: number) => {
  const t = myTeam(s);
  t.fans = Math.max(100, Math.round(t.fans * (1 + pct / 100)));
  changeSatisfaction(s, pct * 1.2, 'Decisión de la semana');
};

const TEMPLATES: Template[] = [
  {
    key: 'pena',
    icon: '🎉',
    create: (_s, e) => {
      const coste = roundMoney(e * 0.04);
      return {
        title: 'La peña pide entradas más baratas',
        body: 'La peña de aficionados más antigua del club pide un descuento para el próximo partido en casa.',
        options: [
          { label: 'Hacer el descuento', hint: `−${fmtMoney(coste)}, la afición crece` },
          { label: 'No hacer descuento', hint: 'La afición se enfada un poco' },
        ],
        data: { coste },
      };
    },
    apply: (s, o, d) => {
      if (o === 0) { caja(s, -Number(d.coste)); aficion(s, 4); return 'La peña lo agradece: la afición crece.'; }
      aficion(s, -1.5);
      return 'Algunos aficionados se quejan en redes.';
    },
  },
  {
    key: 'aumento',
    icon: '💰',
    create: (s) => {
      const top = [...mySquad(s)].sort((a, b) => b.ovr - a.ovr).slice(0, 5);
      if (!top.length) return null;
      const p = pick(top);
      const subida = roundMoney(p.salary * 0.2);
      return {
        title: `${p.name} pide una subida de sueldo`,
        body: `Uno de nuestros mejores jugadores (${p.pos}, media ${p.ovr}) dice que otros clubes le pagarían más.`,
        options: [
          { label: 'Subirle un 20%', hint: `+${fmtMoney(subida)}/temporada en salarios` },
          { label: 'No subirle', hint: 'Puede bajar su rendimiento' },
        ],
        data: { id: p.id, subida },
      };
    },
    apply: (s, o, d) => {
      const p = s.players.find((x) => x.id === Number(d.id));
      if (!p) return 'El jugador ya no está en el club.';
      if (o === 0) { p.salary += Number(d.subida); changeMorale(s, 2); return `${p.name} está contento y renueva su compromiso.`; }
      changeMorale(s, -4);
      if (chance(0.6)) { p.ovr = Math.max(20, p.ovr - 2); return `${p.name} está desmotivado: baja 2 puntos de media y el vestuario lo nota.`; }
      return `${p.name} lo acepta, aunque el vestuario no lo ve con buenos ojos.`;
    },
  },
  {
    key: 'concierto',
    icon: '🎸',
    create: (s, e) => {
      const pago = roundMoney(e * 0.12);
      return {
        title: 'Quieren alquilar el estadio para un concierto',
        body: `Una promotora ofrece dinero por usar «${s.club.identity.stadium}» un fin de semana sin partido.`,
        options: [
          { label: 'Alquilarlo', hint: `+${fmtMoney(pago)}, el césped puede sufrir` },
          { label: 'Rechazar', hint: 'No pasa nada' },
        ],
        data: { pago },
      };
    },
    apply: (s, o, d) => {
      if (o === 1) return 'El estadio queda tranquilo.';
      caja(s, Number(d.pago));
      if (chance(0.4)) {
        const arreglo = roundMoney(Number(d.pago) * 0.35);
        caja(s, -arreglo, 'obras');
        return `Gran concierto. El césped quedó tocado y arreglarlo costó ${fmtMoney(arreglo)}.`;
      }
      return 'Gran concierto y el campo quedó perfecto.';
    },
  },
  {
    key: 'tormenta',
    icon: '⛈️',
    create: (_s, e) => {
      const coste = roundMoney(e * 0.06);
      return {
        title: 'Una tormenta daña el estadio',
        body: 'El viento ha levantado parte de la valla y hay desperfectos en los vestuarios.',
        options: [
          { label: 'Reparar ya', hint: `−${fmtMoney(coste)}` },
          { label: 'Arreglo provisional', hint: 'Más barato, pero la afición lo nota' },
        ],
        data: { coste },
      };
    },
    apply: (s, o, d) => {
      if (o === 0) { caja(s, -Number(d.coste), 'obras'); return 'Todo arreglado para el próximo partido.'; }
      caja(s, -roundMoney(Number(d.coste) * 0.3), 'obras');
      aficion(s, -2);
      return 'Arreglo con parches: algunos aficionados se quejan del estado del campo.';
    },
  },
  {
    key: 'entrevista',
    icon: '🎙️',
    create: (s) => ({
      title: 'Una radio quiere entrevistarte',
      body: `El programa deportivo más escuchado de la comarca quiere hablar con el presidente del ${myTeam(s).name}.`,
      options: [
        { label: 'Dar la entrevista', hint: 'La afición crece (o no, según cómo vaya)' },
        { label: 'Declinar', hint: 'No pasa nada' },
      ],
      data: {},
    }),
    apply: (s, o) => {
      if (o === 1) return 'Prefieres hablar en el campo.';
      if (chance(0.75)) { aficion(s, 3); return 'La entrevista gusta mucho: nuevos aficionados.'; }
      aficion(s, -1);
      return 'Una frase sacada de contexto genera polémica.';
    },
  },
  {
    key: 'fiesta',
    icon: '🍾',
    create: (s) => {
      const lista = mySquad(s);
      if (!lista.length) return null;
      const p = pick(lista);
      return {
        title: `${p.name}, pillado de fiesta`,
        body: 'Han circulado fotos de un jugador de la plantilla de madrugada dos días antes del partido.',
        options: [
          { label: 'Multarle', hint: 'Ingresas la multa, el vestuario lo nota' },
          { label: 'Perdonarle', hint: 'Parte de la afición lo critica' },
        ],
        data: { id: p.id, multa: roundMoney(Math.max(300, p.salary * 0.05)) },
      };
    },
    apply: (s, o, d) => {
      const p = s.players.find((x) => x.id === Number(d.id));
      if (o === 0) {
        caja(s, Number(d.multa));
        changeMorale(s, -3);
        if (p && chance(0.4)) p.ovr = Math.max(20, p.ovr - 1);
        return `Multa de ${fmtMoney(Number(d.multa))}. Mano dura en el club.`;
      }
      aficion(s, -1.5);
      changeMorale(s, 2);
      return 'El jugador pide perdón públicamente y el vestuario lo agradece.';
    },
  },
  {
    key: 'amistoso',
    icon: '🤝',
    create: (_s, e) => ({
      title: 'Proponen un partido benéfico',
      body: 'Una asociación local propone jugar un amistoso a beneficio de una causa solidaria.',
      options: [
        { label: 'Jugarlo', hint: `−${fmtMoney(roundMoney(e * 0.02))} en gastos, la afición crece` },
        { label: 'No hay hueco', hint: 'Algo de mala imagen' },
      ],
      data: { coste: roundMoney(e * 0.02) },
    }),
    apply: (s, o, d) => {
      if (o === 0) { caja(s, -Number(d.coste)); aficion(s, 3.5); return 'Un éxito: el club gana simpatía en toda la comarca.'; }
      aficion(s, -0.5);
      return 'La asociación lo lamenta.';
    },
  },
  {
    key: 'subvencion',
    icon: '🏛️',
    create: (_s, e) => {
      const ayuda = roundMoney(e * 0.15);
      return {
        title: 'El ayuntamiento ofrece una subvención',
        body: 'A cambio, el club debe organizar un campus gratuito para niños este verano.',
        options: [
          { label: 'Aceptar', hint: `+${fmtMoney(ayuda)}, pero el campus cuesta algo` },
          { label: 'Rechazar', hint: 'No pasa nada' },
        ],
        data: { ayuda },
      };
    },
    apply: (s, o, d) => {
      if (o === 1) return 'Rechazas la subvención.';
      const ayuda = Number(d.ayuda);
      caja(s, ayuda);
      caja(s, -roundMoney(ayuda * 0.35), 'personal');
      aficion(s, 1.5);
      return `Subvención cobrada y campus organizado: beneficio neto de ${fmtMoney(roundMoney(ayuda * 0.65))}.`;
    },
  },
  {
    key: 'promesa',
    icon: '🌟',
    create: (s, e) => {
      const coste = roundMoney(e * 0.05);
      return {
        title: 'Un chaval de 16 años quiere venir',
        body: 'Un juvenil de un club vecino ha destacado en un torneo y su familia quiere que juegue en nuestra cantera.',
        options: [
          { label: 'Ficharlo', hint: `−${fmtMoney(coste)}, se incorpora a la plantilla` },
          { label: 'No interesa', hint: 'Se irá a otro club' },
        ],
        data: { coste, division: myTeam(s).division },
      };
    },
    apply: (s, o, d) => {
      if (o === 1) return 'El chaval firma por un rival.';
      caja(s, -Number(d.coste), 'personal');
      const nivel = [64, 55, 48, 40, 33][Number(d.division)];
      const p = makePlayer(s, nivel, { age: 16, teamId: s.club.teamId, contract: 3 });
      p.pot = Math.min(95, p.ovr + randInt(18, 30));
      s.players.push(p);
      return `${p.name} (${p.pos}) se une al club. Media ${p.ovr}, ${potLabel(p.ovr, p.pot)}.`;
    },
  },
  {
    key: 'donacion',
    icon: '🎁',
    create: (_s, e) => {
      const dinero = roundMoney(e * 0.08);
      return {
        title: 'Una leyenda del club hace una donación',
        body: 'Un exjugador histórico quiere aportar dinero para ayudar al club que le vio crecer.',
        options: [{ label: '¡Gracias!', hint: `+${fmtMoney(dinero)}` }],
        data: { dinero },
      };
    },
    apply: (s, _o, d) => {
      caja(s, Number(d.dinero));
      aficion(s, 1);
      return 'La afición aplaude el gesto.';
    },
  },
  {
    key: 'multa',
    icon: '⚖️',
    create: (_s, e) => {
      const multa = roundMoney(e * 0.05);
      return {
        title: 'Multa de la federación',
        body: 'El comité ha sancionado al club por bengalas en la grada en el último partido.',
        options: [
          { label: 'Pagar', hint: `−${fmtMoney(multa)}` },
          { label: 'Recurrir', hint: 'Puedes librarte… o pagar más' },
        ],
        data: { multa },
      };
    },
    apply: (s, o, d) => {
      const multa = Number(d.multa);
      if (o === 0) { caja(s, -multa, 'personal'); return 'Multa pagada.'; }
      if (chance(0.45)) return '¡Recurso aceptado! No pagamos nada.';
      caja(s, -roundMoney(multa * 1.5), 'personal');
      return `Recurso rechazado: la multa sube a ${fmtMoney(roundMoney(multa * 1.5))}.`;
    },
  },
];

/** Probabilidad de que pase algo después de cada jornada */
const PROB = 0.33;

export function maybeCreateEvent(s: GameState) {
  if (s.pendingEvent || !chance(PROB)) return;
  const escala = DIV_SPONSOR[myTeam(s).division];
  // no repetir el último evento
  const candidatos = TEMPLATES.filter((t) => t.key !== s.lastEventKey);
  for (let intento = 0; intento < 4; intento++) {
    const t = pick(candidatos);
    const ev = t.create(s, escala);
    if (!ev) continue;
    s.pendingEvent = { ...ev, id: s.nextId++, key: t.key, icon: t.icon };
    s.lastEventKey = t.key;
    return;
  }
}

export function resolveEvent(s: GameState, opcion: number) {
  const ev = s.pendingEvent;
  if (!ev) return;
  const t = TEMPLATES.find((x) => x.key === ev.key);
  const resultado = t ? t.apply(s, opcion, ev.data) : '';
  addMessage(s, {
    from: 'prensa',
    title: `${ev.icon} ${ev.title}`,
    body: `Decisión: ${ev.options[opcion]?.label ?? '—'}.\n${resultado}`,
  });
  s.pendingEvent = undefined;
  return resultado;
}
