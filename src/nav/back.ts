import { useEffect, useRef } from 'react';

// Botón o gesto "atrás" del móvil: cierra primero la ventana abierta, luego vuelve a la pantalla
// anterior y solo al final sale de la app. Cada cosa que se puede deshacer apila una entrada.

interface Entry {
  id: number;
  onBack?: () => void; // sin función = ya se cerró desde la interfaz (entrada muerta)
}

const pila: Entry[] = [];
let siguiente = 1;

if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => {
    const e = pila.pop();
    if (!e) return;
    // las ventanas cerradas con su botón dejan una entrada muerta: se salta sola
    if (!e.onBack) {
      history.back();
      return;
    }
    e.onBack();
  });
}

/** Apila una acción para el botón atrás; devuelve su id */
export function pushBack(onBack: () => void) {
  const id = siguiente++;
  pila.push({ id, onBack });
  history.pushState({ fowner: id }, '');
  return id;
}

/** La ventana se cerró desde la interfaz: su entrada ya no hace nada */
export function dropBack(id: number) {
  const e = pila.find((x) => x.id === id);
  if (e) e.onBack = undefined;
}

/** Mientras el componente esté montado, "atrás" llama a onBack */
export function useBack(onBack: () => void) {
  const ref = useRef(onBack);
  ref.current = onBack;
  useEffect(() => {
    const id = pushBack(() => ref.current());
    return () => dropBack(id);
  }, []);
}
