import { useState } from 'react';
import type { ScreenProps } from '../App';
import { Segmented } from '../ui';
import Finanzas from './Finanzas';
import Instalaciones from './Instalaciones';

type Zona = 'finanzas' | 'instalaciones';

export default function ClubScreen(props: ScreenProps & { onMenu: () => void; onDelete: () => void }) {
  const [zona, setZona] = useState<Zona>('finanzas');
  return (
    <>
      <Segmented
        value={zona}
        onChange={setZona}
        options={[
          { value: 'finanzas', label: '💰 Finanzas' },
          { value: 'instalaciones', label: '🏗️ Instalaciones' },
        ]}
      />
      {zona === 'finanzas' ? <Finanzas {...props} /> : <Instalaciones {...props} />}
    </>
  );
}
