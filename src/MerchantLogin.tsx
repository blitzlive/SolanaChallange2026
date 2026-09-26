import { useState } from 'react';
import { ArrowRight, Store } from 'lucide-react';
import { locations, type LocationId, type MerchantSession } from '../shared/model';
import { request } from './api';

export function MerchantLogin({ demo, onLogin }: { demo: boolean; onLogin: (session: MerchantSession) => void }) {
  const [site, setSite] = useState<LocationId>('festival');
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return <section className="transaction-card merchant-login" aria-label="Geschäft anmelden">
    <span className="eyebrow"><Store size={16} /> DEIN GESCHÄFTSPROFIL</span>
    <h2>Hier schließt sich der Kreis.</h2>
    <p className="card-description">Für Cafés, Buffets und Festivalstände. Nimm jeden registrierten PfandLoop-Behälter an – auch von anderen Ausgabestellen.</p>
    <form onSubmit={async event => {
      event.preventDefault(); if (busy) return;
      setBusy(true); setError('');
      try { onLogin(await request<MerchantSession>('/merchant/session', { location: site }, key)); }
      catch (error) { setError(error instanceof Error ? error.message : 'Anmeldung fehlgeschlagen.'); }
      finally { setBusy(false); }
    }}>
      <div className="field"><label htmlFor="business">Geschäft auswählen</label><select id="business" value={site} disabled={busy} onChange={event => setSite(event.target.value as LocationId)}>{locations.map(site => <option key={site.id} value={site.id}>{site.name}</option>)}</select></div>
      {!demo && <div className="field"><label htmlFor="operator-key">Betreiber-Schlüssel</label><input id="operator-key" type="password" value={key} onChange={event => setKey(event.target.value)} required autoComplete="off" disabled={busy} /></div>}
      <p className="demo-staff">{demo ? 'Simulierter Geschäftsaccount: Die Anmeldung ist für diese lokale Demo frei zugänglich.' : 'Nur autorisierte Mitarbeitende dürfen Rückgaben bestätigen.'}</p>
      <button className="primary" disabled={busy || (!demo && !key)}>{busy ? 'Anmelden …' : demo ? 'Demo-Geschäft anmelden' : 'Geschäft anmelden'}<ArrowRight size={18} /></button>
      {error && <p className="error" role="alert">{error}</p>}
    </form>
  </section>;
}
