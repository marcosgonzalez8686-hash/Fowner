import { useState } from 'react';

export default function Start({ onStart }: { onStart: (nombre: string) => void }) {
  const [nombre, setNombre] = useState('CD Fowner');
  return (
    <div className="start">
      <img src="./icon.svg" alt="" className="logo" />
      <h1>Fowner</h1>
      <p className="lead">
        Acabas de comprar un club humilde de la Liga Comarcal. Cinco divisiones por delante y una caja muy justa.
      </p>
      <ul className="pitch">
        <li>🏟️ Tú eres el dueño: estadio, entradas, instalaciones y dinero.</li>
        <li>💼 Contrata un director deportivo y elige qué le delegas.</li>
        <li>✅ Para cada tarea: lo haces tú, te lo propone o lo hace solo.</li>
      </ul>
      <label className="field">
        <span>Nombre del club</span>
        <input value={nombre} maxLength={28} onChange={(e) => setNombre(e.target.value)} />
      </label>
      <button className="btn primary big" onClick={() => onStart(nombre)}>
        Comprar el club
      </button>
    </div>
  );
}
