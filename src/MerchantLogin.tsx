import { useState } from 'react';
import { ArrowRight, Store, ShieldCheck } from 'lucide-react';
import { DEMO_CREDENTIALS, locations, type LocationId, type MerchantSession } from '../shared/model';
import { request } from './api';

export function MerchantLogin({ demo, onLogin }: { demo: boolean; onLogin: (session: MerchantSession) => void }) {
  const [site, setSite] = useState<LocationId>('cafe');
  const [username, setUsername] = useState('demo');
  const [password, setPassword] = useState('123456');
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleLogin(selectedSite: LocationId, u?: string, p?: string) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const payload: { location: LocationId; username?: string; password?: string } = { location: selectedSite };
      if (demo) {
        payload.username = u ?? username;
        payload.password = p ?? password;
      }
      const session = await request<MerchantSession>('/merchant/session', payload, key);
      onLogin(session);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed. Please check credentials.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="transaction-card merchant-login" aria-label="Merchant Login">
      <div className="card-top">
        <span className="eyebrow"><Store size={16} /> PARTNER MERCHANT DESK</span>
        <span className="step-label">STAFF ACCESS</span>
      </div>
      <h2>Staff Sign-In.</h2>
      <p className="card-description">
        For partner cafés, dining spots, and festival bars. Issue and accept registered PfandLoop containers with on-chain Proof of Identity.
      </p>

      <form
        onSubmit={e => {
          e.preventDefault();
          void handleLogin(site, username, password);
        }}
      >
        <div className="field">
          <label htmlFor="business">Select Store Station</label>
          <select id="business" value={site} disabled={busy} onChange={e => setSite(e.target.value as LocationId)}>
            {locations.map(s => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.kind})
              </option>
            ))}
          </select>
        </div>

        {demo ? (
          <>
            <div className="field">
              <label htmlFor="merchant-user">Merchant Username</label>
              <input
                id="merchant-user"
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                required
                disabled={busy}
                placeholder="demo"
              />
            </div>

            <div className="field">
              <label htmlFor="merchant-password">Password</label>
              <input
                id="merchant-password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                disabled={busy}
                placeholder="123456"
              />
            </div>

            <div className="demo-credentials-box">
              <div className="credentials-row">
                <span className="cred-badge">MERCHANT ACCOUNT</span>
                <code>Username: <strong>{DEMO_CREDENTIALS.merchant.username}</strong></code>
                <code>Password: <strong>{DEMO_CREDENTIALS.merchant.password}</strong></code>
              </div>
              <button
                type="button"
                className="secondary"
                style={{ width: '100%', marginTop: '8px' }}
                disabled={busy}
                onClick={() => {
                  setUsername(DEMO_CREDENTIALS.merchant.username);
                  setPassword(DEMO_CREDENTIALS.merchant.password);
                  void handleLogin(site, DEMO_CREDENTIALS.merchant.username, DEMO_CREDENTIALS.merchant.password);
                }}
              >
                <span>⚡ 1-Click MVP Sign-In ({DEMO_CREDENTIALS.merchant.username})</span>
              </button>
            </div>
          </>
        ) : (
          <div className="field">
            <label htmlFor="operator-key">Operator Secret Key</label>
            <input
              id="operator-key"
              type="password"
              value={key}
              onChange={e => setKey(e.target.value)}
              required
              autoComplete="off"
              disabled={busy}
            />
          </div>
        )}

        <button className="primary" style={{ width: '100%', marginTop: '14px' }} disabled={busy || (!demo && !key)}>
          {busy ? 'Signing in …' : 'Open Partner Merchant Station'}
          <ArrowRight size={18} />
        </button>

        {error && <p className="error" role="alert" style={{ marginTop: '12px' }}>{error}</p>}
      </form>
    </section>
  );
}
