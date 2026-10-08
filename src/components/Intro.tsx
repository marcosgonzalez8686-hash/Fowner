import { useState } from 'react';
import { useBack } from '../nav/back';

// Bienvenida de una partida nueva: tres ideas y a jugar. Se puede saltar y volver a ver desde el menú.
const SLIDES = [
  {
    ico: '🏟️',
    titulo: 'Eres el dueño',
    texto: 'Has comprado un club humilde de la Liga Comarcal. Tu trabajo no es entrenar: es hacer crecer el club sin arruinarlo.',
  },
  {
    ico: '🧢',
    titulo: 'El entrenador manda en el campo',
    texto: 'Él elige el once y juega con su sistema. Tú decides a quién contratas… y a quién despides si no funciona.',
  },
  {
    ico: '💰',
    titulo: 'Tú pones el dinero',
    texto: 'Patrocinadores, entradas, fichajes, sueldos y estadio. Anuncia un objetivo cada temporada y cúmplelo: si la afición se harta, te obligará a vender.',
  },
];

export default function Intro({ onClose }: { onClose: () => void }) {
  const [i, setI] = useState(0);
  useBack(onClose);
  const sl = SLIDES[i];
  const ultima = i === SLIDES.length - 1;
  return (
    <div className="overlay intro" role="dialog" aria-label="Bienvenida">
      <div className="overlay-inner">
        <button className="link intro-skip" onClick={onClose}>Saltar</button>
        <div className="intro-body">
          <div className="intro-ico" aria-hidden>{sl.ico}</div>
          <h1>{sl.titulo}</h1>
          <p>{sl.texto}</p>
        </div>
        <div className="intro-dots" aria-hidden>
          {SLIDES.map((x, j) => <i key={x.titulo} className={j === i ? 'on' : ''} />)}
        </div>
        <div className="overlay-actions">
          <button className="btn primary big full" onClick={() => (ultima ? onClose() : setI(i + 1))}>
            {ultima ? '¡A jugar!' : 'Siguiente'}
          </button>
        </div>
      </div>
    </div>
  );
}
