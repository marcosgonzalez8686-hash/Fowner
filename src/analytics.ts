// Estadísticas de uso anónimas con GoatCounter: sin cookies ni datos personales.
// Solo cuenta visitas y unos pocos eventos de juego (partida nueva, temporada cerrada, ascensos).

const CUENTA = 'https://marcosg.goatcounter.com/count';

declare global {
  interface Window {
    goatcounter?: { count: (o: { path: string; title?: string; event?: boolean }) => void; no_onload?: boolean };
  }
}

/** Carga el contador (solo en la versión publicada, nunca en desarrollo) */
export function startAnalytics() {
  if (!import.meta.env.PROD || typeof document === 'undefined') return;
  const s = document.createElement('script');
  s.async = true;
  s.src = 'https://gc.zgo.at/count.js';
  s.dataset.goatcounter = CUENTA;
  document.head.appendChild(s);
}

/** Apunta un evento de juego (si el contador no ha cargado, no pasa nada) */
export function track(evento: string, titulo?: string) {
  try {
    window.goatcounter?.count({ path: evento, title: titulo ?? evento, event: true });
  } catch {
    // sin conexión o bloqueado: da igual
  }
}
