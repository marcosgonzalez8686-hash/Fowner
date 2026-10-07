import { useRef, type ReactNode, type TouchEvent } from 'react';
import { Segmented } from '../ui';

/** Zonas donde el gesto horizontal es de la propia pieza (tablas anchas, mapa 3D, gráficos, filtros) */
const SIN_DESLIZAR = '.table-scroll, canvas, .chips, .seg, .chart, input, [data-noswipe]';

/** Contenedor de pestaña con subapartados; se puede pasar de uno a otro deslizando el dedo */
export default function Tabs<T extends string>({ value, onChange, options, children }: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  children: ReactNode;
}) {
  const inicio = useRef<{ x: number; y: number; t: number } | null>(null);

  const onTouchStart = (e: TouchEvent) => {
    const objetivo = e.target as HTMLElement;
    inicio.current = e.touches.length === 1 && !objetivo.closest(SIN_DESLIZAR)
      ? { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() }
      : null;
  };
  const onTouchEnd = (e: TouchEvent) => {
    const i = inicio.current;
    inicio.current = null;
    if (!i) return;
    const dx = e.changedTouches[0].clientX - i.x;
    const dy = e.changedTouches[0].clientY - i.y;
    // gesto claramente horizontal y rápido
    if (Math.abs(dx) < 70 || Math.abs(dy) > Math.abs(dx) * 0.6 || Date.now() - i.t > 600) return;
    const pos = options.findIndex((o) => o.value === value);
    const sig = options[pos + (dx < 0 ? 1 : -1)];
    if (sig) {
      onChange(sig.value);
      window.scrollTo(0, 0);
    }
  };

  return (
    <>
      <div className="subtabs">
        <Segmented value={value} onChange={onChange} options={options} />
      </div>
      <div className="swipe-area" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        {children}
      </div>
    </>
  );
}
