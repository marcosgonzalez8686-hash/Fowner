/** Nota de un partido con color: verde si es buena, rojo si es mala */
export function RatingBadge({ v, round }: { v: number; round?: boolean }) {
  const cls = v >= 7.5 ? 'top' : v >= 6.5 ? 'good' : v >= 5.5 ? 'ok' : 'bad';
  return <span className={`rating ${cls}`}>{round ? Math.round(v) : v.toFixed(1).replace('.', ',')}</span>;
}

/** Últimas notas en fila, la más antigua a la izquierda (p. ej. 4-7-8-7-6) */
export function FormStrip({ form }: { form?: number[] }) {
  if (!form?.length) return <span className="small muted">—</span>;
  return (
    <span className="form-strip" aria-label={`Últimas notas: ${form.map((n) => Math.round(n)).join(', ')}`}>
      {form.map((n, i) => (
        <RatingBadge key={i} v={n} round />
      ))}
    </span>
  );
}
