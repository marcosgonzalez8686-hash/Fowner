import { useState } from 'react';
import {
  CREST_DIVISIONS, CREST_SHAPES, CREST_SYMBOLS, SHIRT_PATTERNS, SWATCHES,
  type Crest as CrestT, type Kit,
} from '../game/identity';
import Crest from './Crest';
import KitView from './KitView';

export function ColorPicker({ label, value, onChange }: { label: string; value: string; onChange: (c: string) => void }) {
  return (
    <div className="color-picker">
      <div className="color-label">
        <span>{label}</span>
        <label className="color-custom" title="Otro color">
          <span className="swatch" style={{ background: value }} />
          <span className="small">Otro…</span>
          <input type="color" value={value} onChange={(e) => onChange(e.target.value)} />
        </label>
      </div>
      <div className="swatches">
        {SWATCHES.map((c) => (
          <button
            key={c}
            className={`swatch${c.toLowerCase() === value.toLowerCase() ? ' on' : ''}`}
            style={{ background: c }}
            onClick={() => onChange(c)}
            aria-label={c}
          />
        ))}
      </div>
    </div>
  );
}

function Options<T extends string>({ value, options, onChange }: {
  value: T; options: { value: T; label: string }[]; onChange: (v: T) => void;
}) {
  return (
    <div className="chips wrap">
      {options.map((o) => (
        <button key={o.value} className={o.value === value ? 'on' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function CrestEditor({ value, onChange }: { value: CrestT; onChange: (c: CrestT) => void }) {
  const set = <K extends keyof CrestT>(k: K, v: CrestT[K]) => onChange({ ...value, [k]: v });
  return (
    <div className="editor">
      <div className="preview">
        <Crest c={value} size={110} />
      </div>
      <h4>Forma</h4>
      <Options value={value.shape} options={CREST_SHAPES} onChange={(v) => set('shape', v)} />
      <h4>Diseño del fondo</h4>
      <Options value={value.division} options={CREST_DIVISIONS} onChange={(v) => set('division', v)} />
      <ColorPicker label="Color principal" value={value.color1} onChange={(v) => set('color1', v)} />
      {value.division !== 'liso' && <ColorPicker label="Segundo color" value={value.color2} onChange={(v) => set('color2', v)} />}
      <ColorPicker label="Borde" value={value.border} onChange={(v) => set('border', v)} />
      <h4>Símbolo</h4>
      <Options value={value.symbol} options={CREST_SYMBOLS} onChange={(v) => set('symbol', v)} />
      <label className="field">
        <span>Iniciales (hasta 4 letras, opcional)</span>
        <input
          value={value.initials}
          maxLength={4}
          onChange={(e) => set('initials', e.target.value.toUpperCase().replace(/[^A-ZÁÉÍÓÚÑÜ0-9]/gi, ''))}
        />
      </label>
      <ColorPicker label="Color del símbolo y las letras" value={value.symbolColor} onChange={(v) => set('symbolColor', v)} />
    </div>
  );
}

export function KitEditor({ value, onChange }: { value: Kit; onChange: (k: Kit) => void }) {
  const set = <K extends keyof Kit>(k: K, v: Kit[K]) => onChange({ ...value, [k]: v });
  return (
    <div className="editor">
      <div className="preview">
        <KitView k={value} size={90} />
      </div>
      <h4>Camiseta</h4>
      <Options value={value.pattern} options={SHIRT_PATTERNS} onChange={(v) => set('pattern', v)} />
      <ColorPicker label="Color de la camiseta" value={value.shirt} onChange={(v) => set('shirt', v)} />
      <ColorPicker
        label={value.pattern === 'liso' ? 'Cuello y detalles' : 'Segundo color'}
        value={value.shirt2}
        onChange={(v) => set('shirt2', v)}
      />
      <ColorPicker label="Pantalón" value={value.shorts} onChange={(v) => set('shorts', v)} />
      <ColorPicker label="Medias" value={value.socks} onChange={(v) => set('socks', v)} />
    </div>
  );
}

/** Editor de las dos equipaciones con pestañas */
export function KitsEditor({ home, away, onChange }: { home: Kit; away: Kit; onChange: (home: Kit, away: Kit) => void }) {
  const [cual, setCual] = useState<'home' | 'away'>('home');
  return (
    <>
      <div className="kits-tabs">
        <button className={cual === 'home' ? 'on' : ''} onClick={() => setCual('home')}>
          <KitView k={home} size={40} />
          <span>Titular</span>
        </button>
        <button className={cual === 'away' ? 'on' : ''} onClick={() => setCual('away')}>
          <KitView k={away} size={40} />
          <span>Suplente</span>
        </button>
      </div>
      {cual === 'home' ? (
        <KitEditor value={home} onChange={(k) => onChange(k, away)} />
      ) : (
        <KitEditor value={away} onChange={(k) => onChange(home, k)} />
      )}
    </>
  );
}
