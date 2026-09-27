import { useState } from 'react';
import { ArrowRight, Leaf, ShieldCheck, User } from 'lucide-react';
import { DEMO_CREDENTIALS, type UserSession } from '../shared/model';
import { request } from './api';

export function UserLogin({ onLogin }: { onLogin: (session: UserSession) => void }) {
  const [username, setUsername] = useState('user-demo');
  const [password, setPassword] = useState('123456');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleLogin(u: string, p: string) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const session = await request<UserSession>('/user/session', { username: u, password: p });
      onLogin(session);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed. Please check credentials.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="transaction-card user-login" aria-label="Customer Login">
      <div className="card-top">
        <span className="eyebrow"><User size={15} /> CUSTOMER PORTAL</span>
        <span className="step-label">MEMBER ACCESS</span>
      </div>
      <h2>Welcome to Your PfandLoop Wallet.</h2>
      <p className="card-description">
        Access your reusable cup inventory, view live Solana deposit balances, and show your digital member pass at any partner store.
      </p>

      <form
        onSubmit={e => {
          e.preventDefault();
          void handleLogin(username, password);
        }}
      >
        <div className="field">
          <label htmlFor="user-username">Username</label>
          <input
            id="user-username"
            type="text"
            value={username}
            onChange={e => setUsername(e.target.value)}
            required
            autoComplete="username"
            disabled={busy}
            placeholder="user-demo"
          />
        </div>

        <div className="field">
          <label htmlFor="user-password">Password</label>
          <input
            id="user-password"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            disabled={busy}
            placeholder="123456"
          />
        </div>

        <div className="demo-credentials-box">
          <div className="credentials-row">
            <span className="cred-badge">TEST CREDENTIALS</span>
            <code>Password: <strong>{DEMO_CREDENTIALS.user.password}</strong></code>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '6px', marginTop: '8px' }}>
            <button
              type="button"
              className="secondary"
              style={{ padding: '6px 10px', fontSize: '11px', textAlign: 'center' }}
              disabled={busy}
              onClick={() => {
                setUsername('user-demo');
                setPassword('123456');
                void handleLogin('user-demo', '123456');
              }}
            >
              <span>⚡ user-demo</span>
            </button>
            <button
              type="button"
              className="secondary"
              style={{ padding: '6px 10px', fontSize: '11px', textAlign: 'center' }}
              disabled={busy}
              onClick={() => {
                setUsername('sam.sol');
                setPassword('123456');
                void handleLogin('sam.sol', '123456');
              }}
            >
              <span>⚡ sam.sol</span>
            </button>
            <button
              type="button"
              className="secondary"
              style={{ padding: '6px 10px', fontSize: '11px', textAlign: 'center' }}
              disabled={busy}
              onClick={() => {
                setUsername('taylor.sol');
                setPassword('123456');
                void handleLogin('taylor.sol', '123456');
              }}
            >
              <span>⚡ taylor.sol</span>
            </button>
          </div>
        </div>

        <button className="primary" style={{ width: '100%', marginTop: '14px' }} disabled={busy}>
          {busy ? 'Signing In …' : 'Sign In as Member'}
          <ArrowRight size={18} />
        </button>

        {error && <p className="error" role="alert" style={{ marginTop: '12px' }}>{error}</p>}
      </form>
    </section>
  );
}
