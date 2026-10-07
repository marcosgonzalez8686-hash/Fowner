import { useState, type PointerEvent } from 'react';
import { fmtMoney } from '../game/economy';

// Gráficos SVG sencillos. Colores de serie en CSS (--s1 ingresos/caja, --s2 gastos),
// validados para daltonismo en modo claro y oscuro.

const W = 340;

function niceMax(v: number) {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}

/** Evolución de la caja por jornada, con la previsión en discontinuo */
export function CashChart({ real, forecast, total }: { real: number[]; forecast: number[]; total: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const H = 170;
  const pad = { l: 8, r: 8, t: 14, b: 22 };
  const todos = [...real, ...forecast];
  const max = niceMax(Math.max(...todos, 0));
  const minRaw = Math.min(...todos, 0);
  const min = minRaw < 0 ? -niceMax(-minRaw) : 0;
  const x = (i: number) => pad.l + (i / total) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + ((max - v) / (max - min)) * (H - pad.t - pad.b);
  const path = (pts: [number, number][]) => pts.map(([i, v], k) => `${k ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('');
  const realPts = real.map((v, i) => [i, v] as [number, number]);
  const ini = real.length - 1;
  const prevPts = forecast.map((v, k) => [ini + k, v] as [number, number]);
  const ticks = [max, max / 2, 0, ...(min < 0 ? [min] : [])];

  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const i = Math.round((((e.clientX - r.left) / r.width) * W - pad.l) / ((W - pad.l - pad.r) / total));
    setHover(Math.max(0, Math.min(total, i)));
  };
  const valorEn = (i: number) => (i < real.length ? real[i] : forecast[i - ini]);
  const v = hover !== null ? valorEn(hover) : undefined;
  const finPrev = prevPts.at(-1);

  return (
    <div className="chart">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="Evolución de la caja por jornada y previsión hasta final de temporada"
        onPointerMove={onMove}
        onPointerDown={onMove}
        onPointerLeave={() => setHover(null)}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} className={t === 0 ? 'axis-zero' : 'grid'} />
            <text x={pad.l + 2} y={y(t) - 3} className="tick">{fmtMoney(t)}</text>
          </g>
        ))}
        {[0, 19, total].map((j) => (
          <text key={j} x={x(j)} y={H - 6} className="tick" textAnchor={j === 0 ? 'start' : j === total ? 'end' : 'middle'}>
            {j === 0 ? 'Inicio' : `J${j}`}
          </text>
        ))}
        {prevPts.length > 1 && <path d={path(prevPts)} className="line s1 dashed" />}
        {realPts.length > 1 && <path d={path(realPts)} className="line s1" />}
        <circle cx={x(ini)} cy={y(real[ini])} r="4" className="dot s1" />
        {finPrev && prevPts.length > 1 && (
          <text x={x(finPrev[0]) - 2} y={y(finPrev[1]) - 8} className="label" textAnchor="end">
            {fmtMoney(finPrev[1])}
          </text>
        )}
        {hover !== null && v !== undefined && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={H - pad.b} className="crosshair" />
            <circle cx={x(hover)} cy={y(v)} r="4.5" className="dot s1 ring" />
          </g>
        )}
      </svg>
      <div className="chart-foot">
        {hover !== null && v !== undefined ? (
          <span>
            <b>{hover === 0 ? 'Inicio' : `Jornada ${hover}`}</b> · {fmtMoney(v)} {hover > ini ? '(previsión)' : ''}
          </span>
        ) : (
          <span className="muted">
            <span className="key-line" /> real <span className="key-line dashed" /> previsión · toca el gráfico para ver cada jornada
          </span>
        )}
      </div>
    </div>
  );
}

export interface BarItem { label: string; value: number; kind: 'in' | 'out' }

/** Barras horizontales de ingresos y gastos por concepto */
export function ConceptBars({ items }: { items: BarItem[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const datos = items.filter((d) => d.value > 0);
  if (!datos.length) return <p className="muted small">Todavía no hay movimientos esta temporada.</p>;
  const max = Math.max(...datos.map((d) => d.value));
  const fila = 26;
  const labelW = 118;
  const H = datos.length * fila + 4;
  return (
    <div className="chart">
      <div className="legend-row">
        <span><i className="sw s1" /> Ingresos</span>
        <span><i className="sw s2" /> Gastos</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Ingresos y gastos por concepto esta temporada">
        {datos.map((d, i) => {
          const w = Math.max(2, (d.value / max) * (W - labelW - 70));
          const yy = i * fila + 4;
          return (
            <g key={d.label} onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)} onPointerDown={() => setHover(i)}>
              <rect x="0" y={yy - 2} width={W} height={fila} fill="transparent" />
              <text x={labelW - 6} y={yy + 13} className="tick strong" textAnchor="end">{d.label}</text>
              <path
                d={`M${labelW},${yy + 4} h${w - 4} a4,4 0 0 1 4,4 v6 a4,4 0 0 1 -4,4 h-${w - 4} z`}
                className={`bar ${d.kind === 'in' ? 's1' : 's2'}${hover === i ? ' hot' : ''}`}
              />
              <text x={labelW + w + 6} y={yy + 13} className="label">{fmtMoney(d.value)}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/** Resultado (beneficio o pérdida) de cada temporada */
export function SeasonResults({ rows }: { rows: { label: string; value: number; sub: string }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const H = 150;
  const pad = { t: 18, b: 34 };
  const maxAbs = niceMax(Math.max(...rows.map((r) => Math.abs(r.value)), 1));
  const hayNeg = rows.some((r) => r.value < 0);
  const zeroY = hayNeg ? pad.t + (H - pad.t - pad.b) / 2 : H - pad.b;
  const escala = (hayNeg ? (H - pad.t - pad.b) / 2 : H - pad.t - pad.b) / maxAbs;
  const ancho = Math.min(40, (W - 20) / rows.length - 8);
  return (
    <div className="chart">
      <div className="legend-row">
        <span><i className="sw s1" /> Beneficio</span>
        <span><i className="sw s2" /> Pérdida</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Resultado económico de cada temporada">
        <line x1="0" x2={W} y1={zeroY} y2={zeroY} className="axis-zero" />
        {rows.map((r, i) => {
          const cx = 10 + (i + 0.5) * ((W - 20) / rows.length);
          const h = Math.max(2, Math.abs(r.value) * escala);
          const pos = r.value >= 0;
          const yTop = pos ? zeroY - h : zeroY;
          return (
            <g key={r.label} onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)} onPointerDown={() => setHover(i)}>
              <rect x={cx - ancho / 2 - 4} y={pad.t - 10} width={ancho + 8} height={H - pad.t} fill="transparent" />
              <rect x={cx - ancho / 2} y={yTop} width={ancho} height={h} rx="4" className={`bar ${pos ? 's1' : 's2'}${hover === i ? ' hot' : ''}`} />
              <text x={cx} y={H - 18} className="tick" textAnchor="middle">{r.label}</text>
              <text x={cx} y={H - 5} className="tick" textAnchor="middle">{r.sub}</text>
              {(hover === i || rows.length <= 6) && (
                <text x={cx} y={pos ? yTop - 4 : yTop + h + 11} className="label" textAnchor="middle">{fmtMoney(r.value)}</text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
