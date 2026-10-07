import type { ReactNode } from 'react';
import { Segmented } from '../ui';

/** Contenedor de pestaña con subapartados */
export default function Tabs<T extends string>({ value, onChange, options, children }: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  children: ReactNode;
}) {
  return (
    <>
      <div className="subtabs">
        <Segmented value={value} onChange={onChange} options={options} />
      </div>
      {children}
    </>
  );
}
