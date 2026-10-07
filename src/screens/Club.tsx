import { useState } from 'react';
import type { ScreenProps } from '../App';
import { Segmented } from '../ui';
import Finanzas from './Finanzas';
import Instalaciones from './Instalaciones';
import Empleados from './Empleados';

type Zona = 'finanzas' | 'instalaciones' | 'empleados';

export default function ClubScreen(props: ScreenProps & { onMenu: () => void; onDelete: () => void }) {
  const [zona, setZona] = useState<Zona>('finanzas');
  return (
    <>
      <Segmented
        value={zona}
        onChange={setZona}
        options={[
          { value: 'finanzas', label: '💰 Finanzas' },
          { value: 'instalaciones', label: '🏗️ Instalac.' },
          { value: 'empleados', label: '👔 Empleados' },
        ]}
      />
      {zona === 'finanzas' && <Finanzas {...props} />}
      {zona === 'instalaciones' && <Instalaciones {...props} />}
      {zona === 'empleados' && <Empleados {...props} />}
    </>
  );
}
