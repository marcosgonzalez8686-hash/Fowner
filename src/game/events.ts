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
  {
    key: 'tv_entreno',
    icon: '📺',
    create: (_s, e) => {
      const pago = roundMoney(e * 0.05);
      return {
        title: 'Una tele local quiere grabar los entrenamientos',
        body: 'Preparan un reportaje sobre el día a día del club y pagarían por grabar toda la semana.',
        options: [
          { label: 'Dejarles grabar', hint: `+${fmtMoney(pago)}, al vestuario no le gustan las cámaras` },
          { label: 'Puertas cerradas', hint: 'No pasa nada' },
        ],
        data: { pago },
      };
    },
    apply: (s, o, d) => {
      if (o === 1) return 'Los entrenamientos siguen a puerta cerrada.';
      caja(s, Number(d.pago));
      aficion(s, 1.5);
      changeMorale(s, -2);
      return 'El reportaje gusta en la comarca, aunque algunos jugadores se quejaron de las cámaras.';
    },
  },
  {
    key: 'retro',
    icon: '👕',
    create: (_s, e) => {
      const coste = roundMoney(e * 0.05);
      return {
        title: 'Proponen una camiseta retro',
        body: 'El departamento comercial quiere sacar una edición especial inspirada en la primera equipación del club.',
        options: [
          { label: 'Sacarla', hint: `−${fmtMoney(coste)} de producción; puede venderse muy bien… o no` },
          { label: 'No es el momento', hint: 'No pasa nada' },
        ],
        data: { coste },
      };
    },
    apply: (s, o, d) => {
      if (o === 1) return 'La idea queda en un cajón.';
      const coste = Number(d.coste);
      caja(s, -coste, 'obras');
      if (chance(0.6)) {
        const ventas = roundMoney(coste * (2 + Math.random() * 2));
        caja(s, ventas);
        aficion(s, 2);
        return `¡Se agota! Ventas de ${fmtMoney(ventas)} y la grada encantada.`;
      }
      caja(s, roundMoney(coste * 0.5));
      return 'Se vende a medias: apenas recuperas la mitad de lo invertido.';
    },
  },
  {
    key: 'hospital',
    icon: '🏥',
    create: () => ({
      title: 'Visita al hospital infantil',
      body: 'El hospital de la comarca pregunta si la plantilla podría visitar a los niños ingresados.',
      options: [
        { label: 'Ir con toda la plantilla', hint: 'La grada y el vestuario lo agradecen; un día menos de entreno' },
        { label: 'Que vayan dos jugadores', hint: 'Un gesto más discreto' },
      ],
      data: {},
    }),
    apply: (s, o) => {
      if (o === 0) {
        aficion(s, 2.5);
        changeMorale(s, 3);
        for (const p of mySquad(s)) p.fatigue = Math.min(100, (p.fatigue ?? 0) + 5);
        return 'Una tarde emocionante: las fotos dan la vuelta a la comarca.';
      }
      aficion(s, 1);
      return 'Los niños disfrutan con la visita.';
    },
  },
  {
    key: 'provocacion',
    icon: '🗯️',
    create: (s) => {
      const rivales = s.teams.filter((t) => t.division === myTeam(s).division && t.id !== s.club.teamId);
      if (!rivales.length) return null;
      const r = pick(rivales);
      return {
        title: `El presidente del ${r.name} nos provoca`,
        body: `En una entrevista ha dicho que el ${myTeam(s).name} «es un club sin proyecto y con un dueño de paso».`,
        options: [
          { label: 'Responder con dureza', hint: 'La grada se enciende… y la liga puede multarte' },
          { label: 'No entrar al trapo', hint: 'Imagen de seriedad' },
        ],
        data: { multa: roundMoney(Math.max(1000, DIV_SPONSOR[myTeam(s).division] * 0.03)) },
      };
    },
    apply: (s, o, d) => {
      if (o === 1) { changeMorale(s, 1); return 'Respondes en el campo. El vestuario toma nota.'; }
      aficion(s, 2);
      changeMorale(s, 2);
      if (chance(0.35)) {
        caja(s, -Number(d.multa), 'personal');
        return `La grada lo celebra, pero el comité te multa con ${fmtMoney(Number(d.multa))} por tus palabras.`;
      }
      return 'Tus palabras incendian la previa: la grada está más unida que nunca.';
    },
  },
  {
    key: 'apuestas',
    icon: '🎰',
    create: (_s, e) => {
      const pago = roundMoney(e * 0.2);
      return {
        title: 'Una casa de apuestas quiere patrocinarnos',
        body: 'Pagarían bien por poner su logo en las vallas del estadio, pero parte de la afición está en contra de este tipo de patrocinios.',
        options: [
          { label: 'Firmar', hint: `+${fmtMoney(pago)}, la afición se enfada` },
          { label: 'Rechazar', hint: 'La afición lo valora' },
        ],
        data: { pago },
      };
    },
    apply: (s, o, d) => {
      if (o === 0) { caja(s, Number(d.pago)); aficion(s, -3); return 'El dinero entra, pero hay pancartas en contra en la grada.'; }
      aficion(s, 1);
      return 'La peña aplaude la decisión en sus redes.';
    },
  },
  {
    key: 'cesped',
    icon: '🌱',
    create: (_s, e) => {
      const coste = roundMoney(e * 0.07);
      return {
        title: 'El césped está en mal estado',
        body: 'El jardinero avisa: hay calvas y zonas duras. Los jugadores se quejan de que es peligroso.',
        options: [
          { label: 'Cambiar el césped', hint: `−${fmtMoney(coste)}` },
          { label: 'Aguantar hasta verano', hint: 'Riesgo de lesiones' },
        ],
        data: { coste },
      };
    },
    apply: (s, o, d) => {
      if (o === 0) { caja(s, -Number(d.coste), 'obras'); return 'Césped nuevo: los jugadores lo notan.'; }
      if (chance(0.5)) {
        const sanos = mySquad(s).filter((p) => !(p.injury && p.injury > 0));
        if (sanos.length) {
          const p = pick(sanos);
          p.injury = randInt(1, 3);
          addMessage(s, { from: 'club', title: `🤕 ${p.name} se lesiona`, body: `Un mal apoyo en el césped del estadio: ${p.injury} jornada(s) de baja.` });
          return `${p.name} se lesiona entrenando en el césped (${p.injury} jornadas).`;
        }
      }
      return 'De momento nadie se ha hecho daño.';
    },
  },
  {
    key: 'homenaje',
    icon: '🏆',
    create: (_s, e) => {
      const coste = roundMoney(e * 0.04);
      return {
        title: 'Piden un homenaje a una leyenda',
        body: 'Los veteranos proponen un partido homenaje al capitán que llevó al club a su mejor época.',
        options: [
          { label: 'Organizarlo', hint: `−${fmtMoney(coste)}, la afición se emociona` },
          { label: 'Más adelante', hint: 'A los veteranos no les gusta' },
        ],
        data: { coste },
      };
    },
    apply: (s, o, d) => {
      if (o === 0) {
        caja(s, -Number(d.coste), 'personal');
        aficion(s, 3);
        const t = myTeam(s);
        t.fans = Math.round(t.fans * 1.01);
        return 'Lleno, lágrimas y bufandas al aire: un día para recordar.';
      }
      aficion(s, -1);
      return 'Los veteranos se sienten olvidados.';
    },
  },
  {
    key: 'metodo',
    icon: '🧪',
    create: (s, e) => {
      if (!s.club.staff.entrenador) return null;
      const coste = roundMoney(e * 0.06);
      return {
        title: 'El entrenador pide un preparador de recuperación',
        body: 'Quiere contratar unas semanas a un especialista en recuperación física y nutrición.',
        options: [
          { label: 'Pagarlo', hint: `−${fmtMoney(coste)}, la plantilla llega más fresca` },
          { label: 'No hay presupuesto', hint: 'El entrenador no lo entiende' },
        ],
        data: { coste },
      };
    },
    apply: (s, o, d) => {
      const c = s.club.staff.entrenador;
      if (o === 0) {
        caja(s, -Number(d.coste), 'personal');
        for (const p of mySquad(s)) p.fatigue = 0;
        changeMorale(s, 1);
        return 'La plantilla se recupera de golpe: todos al 100%.';
      }
      if (c) c.confidence = Math.max(0, (c.confidence ?? 60) - 4);
      return 'El entrenador acepta la decisión, pero no le ha gustado.';
    },
  },
  {
    key: 'mecenas',
    icon: '🎩',
    create: (_s, e) => {
      const dinero = roundMoney(e * 0.25);
      return {
        title: 'Un empresario quiere poner su nombre a una grada',
        body: 'Pagaría una buena cantidad a cambio de que la grada principal lleve su nombre durante años.',
        options: [
          { label: 'Aceptar', hint: `+${fmtMoney(dinero)}, a los socios no les hace gracia` },
          { label: 'La grada no se vende', hint: 'La afición lo agradece' },
        ],
        data: { dinero },
      };
    },
    apply: (s, o, d) => {
      if (o === 0) { caja(s, Number(d.dinero)); aficion(s, -2); return 'Dinero fresco. Los más veteranos siguen llamándola por su nombre de siempre.'; }
      aficion(s, 1.5);
      return 'La grada mantiene su nombre de toda la vida.';
    },
  },
  {
    key: 'viral',
    icon: '📱',
    create: (_s, e) => {
      const coste = roundMoney(e * 0.03);
      return {
        title: 'Un vídeo del club se hace viral',
        body: 'Un gol de chilena en el entrenamiento lleva millones de visitas. Proponen aprovecharlo con una campaña en redes.',
        options: [
          { label: 'Lanzar la campaña', hint: `−${fmtMoney(coste)}, más aficionados` },
          { label: 'Dejarlo correr', hint: 'Algo de afición nueva igualmente' },
        ],
        data: { coste },
      };
    },
    apply: (s, o, d) => {
      const t = myTeam(s);
      if (o === 0) { caja(s, -Number(d.coste), 'personal'); t.fans = Math.round(t.fans * 1.04); aficion(s, 1.5); return 'La campaña funciona: el club gana seguidores en toda España.'; }
      t.fans = Math.round(t.fans * 1.01);
      return 'El vídeo da la vuelta al país unos días.';
    },
  },
  {
    key: 'periodista',
    icon: '📰',
    create: (s) => {
      const c = s.club.staff.entrenador;
      if (!c) return null;
      return {
        title: `Un periódico carga contra ${c.name}`,
        body: 'Un columnista muy leído dice que el entrenador «no sabe sacar partido a la plantilla».',
        options: [
          { label: 'Respaldarle en público', hint: 'Más confianza del entrenador; parte de la grada no lo comparte' },
          { label: 'No decir nada', hint: 'El entrenador se siente solo' },
        ],
        data: {},
      };
    },
    apply: (s, o) => {
      const c = s.club.staff.entrenador;
      if (!c) return 'El entrenador ya no está.';
      if (o === 0) { c.confidence = Math.min(100, (c.confidence ?? 60) + 8); aficion(s, -0.5); changeMorale(s, 1); return 'El entrenador agradece el respaldo.'; }
      c.confidence = Math.max(0, (c.confidence ?? 60) - 5);
      return 'El silencio del palco se interpreta como falta de confianza.';
    },
  },
  {
    key: 'pide_salir',
    icon: '🚪',
    create: (s) => {
      const suplentes = [...mySquad(s)].sort((a, b) => a.ovr - b.ovr).slice(0, 8).filter((p) => !p.listed && !p.loan);
      if (!suplentes.length) return null;
      const p = pick(suplentes);
      return {
        title: `${p.name} quiere salir`,
        body: `Apenas cuenta para el entrenador y su agente pide que le dejemos buscar equipo.`,
        options: [
          { label: 'Ponerle en el mercado', hint: 'Se le declara transferible; el vestuario lo valora' },
          { label: 'Que se quede', hint: 'Estará descontento' },
        ],
        data: { id: p.id },
      };
    },
    apply: (s, o, d) => {
      const p = mySquad(s).find((x) => x.id === Number(d.id));
      if (!p) return 'Ya no está en el club.';
      if (o === 0) { p.listed = true; changeMorale(s, 1); return `${p.name} pasa a la lista de transferibles.`; }
      changeMorale(s, -2);
      return `${p.name} se queda, pero no está contento.`;
    },
  },
  {
    key: 'arbitro',
    icon: '🧑‍⚖️',
    create: () => ({
      title: 'Polémica arbitral',
      body: 'Un penalti muy dudoso en contra en la última jornada tiene a toda la grada encendida.',
      options: [
        { label: 'Protestar oficialmente', hint: 'La grada lo agradece; puede caer una multa' },
        { label: 'Pedir calma', hint: 'Parte de la afición lo ve tibio' },
      ],
      data: {},
    }),
    apply: (s, o) => {
      if (o === 0) {
        aficion(s, 1.5);
        if (chance(0.4)) {
          const multa = roundMoney(Math.max(800, DIV_SPONSOR[myTeam(s).division] * 0.02));
          caja(s, -multa, 'personal');
          return `La queja llega a la federación… y te multan con ${fmtMoney(multa)}.`;
        }
        return 'La federación toma nota y la grada siente que el club la defiende.';
      }
      aficion(s, -1);
      changeMorale(s, 1);
      return 'Pides calma: el vestuario se centra en el siguiente partido.';
    },
  },
  {
    key: 'error_camisetas',
    icon: '🧵',
    create: (s, e) => {
      const lote = roundMoney(e * 0.03);
      return {
        title: 'Camisetas con una errata',
        body: `Han llegado 500 camisetas con el nombre del club mal escrito: «${myTeam(s).name.replace(/[aeiou]/, 'x')}».`,
        options: [
          { label: 'Venderlas como edición especial', hint: 'Puede hacer gracia… o no' },
          { label: 'Destruirlas', hint: `−${fmtMoney(lote)}` },
        ],
        data: { lote },
      };
    },
    apply: (s, o, d) => {
      const lote = Number(d.lote);
      if (o === 1) { caja(s, -lote, 'obras'); return 'Las camisetas se reciclan. Nadie se entera.'; }
      if (chance(0.6)) { caja(s, roundMoney(lote * 1.8)); aficion(s, 1); return '¡Se convierten en objeto de culto! Se agotan en dos días.'; }
      caja(s, -roundMoney(lote * 0.5), 'obras');
      aficion(s, -0.5);
      return 'Pocos las compran y en redes se ríen del club.';
    },
  },
];

/** Probabilidad de que pase algo después de cada jornada */
const PROB = 0.33;

export function maybeCreateEvent(s: GameState) {
  if (s.pendingEvent || !chance(PROB)) return;
  const escala = DIV_SPONSOR[myTeam(s).division];
  // no repetir los últimos eventos
  const recientes = s.recentEvents ?? (s.lastEventKey ? [s.lastEventKey] : []);
  const candidatos = TEMPLATES.filter((t) => !recientes.includes(t.key));
  for (let intento = 0; intento < 4; intento++) {
    const t = pick(candidatos);
    const ev = t.create(s, escala);
    if (!ev) continue;
    s.pendingEvent = { ...ev, id: s.nextId++, key: t.key, icon: t.icon };
    s.lastEventKey = t.key;
    s.recentEvents = [t.key, ...recientes].slice(0, 8);
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
