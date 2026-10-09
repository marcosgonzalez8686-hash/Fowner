import { ABOUT, APP_VERSION, PRIVACY, PRIVACY_UPDATED } from '../legal/privacy';
import { Sheet } from '../ui';

/** Privacidad y acerca de: lo mismo que la página pública privacidad.html */
export default function Privacidad({ onClose }: { onClose: () => void }) {
  return (
    <Sheet title="🔒 Privacidad y acerca de" onClose={onClose} top>
      <div className="legal">
        <h3>Acerca de Fowner</h3>
        {ABOUT.map((p, i) => <p key={i} className="small">{p}</p>)}
        <p className="small muted">Versión {APP_VERSION}</p>
        <h3>Política de privacidad</h3>
        <p className="small muted">Última actualización: {PRIVACY_UPDATED}</p>
        {PRIVACY.map((sec) => (
          <section key={sec.title}>
            <h4>{sec.title}</h4>
            {sec.body.map((p, i) => <p key={i} className="small">{p}</p>)}
          </section>
        ))}
      </div>
    </Sheet>
  );
}
