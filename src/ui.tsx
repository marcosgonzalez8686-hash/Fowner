import type { ReactNode } from 'react';
import { fmtMoney } from './game/economy';

export const Money = ({ v, sign }: { v: number; sign?: boolean }) => (
  <span className={sign ? (v < 0 ? 'neg' : 'pos') : v < 0 ? 'neg' : undefined}>
    {sign && v > 0 ? '+' : ''}
    {fmtMoney(v)}
  </span>
);

export const Stars = ({ n }: { n: number }) => (
  <span className="stars" aria-label={`${n} estrellas`}>
    {'★'.repeat(n)}
    <span className="dim">{'★'.repeat(5 - n)}</span>
  </span>
);

export function Ovr({ v, base }: { v: number; base?: number }) {
  const diff = base === undefined ? 0 : v - base;
  const cls = diff >= 4 ? 'ovr hi' : diff <= -4 ? 'ovr lo' : 'ovr';
  return <span className={cls}>{v}</span>;
}

export function Segmented<T extends string>(props: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  disabled?: boolean;
}) {
  return (
    <div className={`seg${props.disabled ? ' disabled' : ''}`} role="radiogroup">
      {props.options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={props.value === o.value}
          className={props.value === o.value ? 'on' : ''}
          disabled={props.disabled}
          onClick={() => props.onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="sheet-bg" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={title}>
        <div className="sheet-head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Stepper({ value, step, min = 0, onChange, format }: {
  value: number; step: number; min?: number; onChange: (v: number) => void; format: (v: number) => string;
}) {
  return (
    <div className="stepper">
      <button onClick={() => onChange(Math.max(min, value - step))} aria-label="Bajar">−</button>
      <span>{format(value)}</span>
      <button onClick={() => onChange(value + step)} aria-label="Subir">+</button>
    </div>
  );
}

export const Card = ({ title, children, right }: { title?: string; children: ReactNode; right?: ReactNode }) => (
  <section className="card">
    {title && (
      <div className="card-head">
        <h2>{title}</h2>
        {right}
      </div>
    )}
    {children}
  </section>
);
