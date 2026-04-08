import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../stores/auth';
import { api } from '../lib/api';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await api.login(email, password);
      login({
        accessToken: res.accessToken,
        refreshToken: res.refreshToken,
        role: res.role,
        eventId: (res as any).eventId ?? (import.meta.env.VITE_DEMO_MODE === 'true' ? 'demo-event' : undefined),
        eventName: (res as any).eventName ?? (import.meta.env.VITE_DEMO_MODE === 'true' ? 'Demo-arrangement' : undefined),
      });
      navigate('/coordinator');
    } catch (err: any) {
      setError(err.message || 'Innlogging feilet');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="page-center"
    >
      <div style={{ width: '100%', maxWidth: 400 }}>
        <h1 className="text-xl fw-700 mb-2">
          Koordinator-innlogging
        </h1>
        <p className="text-sm text-muted mb-6">
          For koordinatorer og administratorer
        </p>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label
              htmlFor="email"
              className="field-label"
            >
              E-post
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="admin@rkf.no"
              className="form-input"
              style={{ padding: '0 var(--space-4)', fontFamily: 'var(--font-sans)' }}
            />
          </div>

          <div className="mb-6">
            <label
              htmlFor="password"
              className="field-label"
            >
              Passord
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="form-input"
              style={{ padding: '0 var(--space-4)', fontFamily: 'var(--font-sans)' }}
            />
          </div>

          <div
            id="login-form-error"
            role="alert"
            aria-atomic="true"
            style={{
              color: 'var(--color-status-critical)',
              fontSize: 'var(--text-sm)',
              marginBottom: error ? 'var(--space-4)' : 0,
            }}
          >
            {error || ''}
          </div>

          <button
            type="submit"
            disabled={loading}
            aria-describedby="login-form-error"
            className="touch-target"
            style={{
              width: '100%',
              height: 'var(--touch-min)',
              borderRadius: 'var(--radius-md)',
              border: 'none',
              background: 'var(--color-brand)',
              color: 'white',
              fontSize: 'var(--text-base)',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Logger inn...' : 'Logg inn'}
          </button>
        </form>

        <Link
          to="/"
          className="mono-xs-subtle mt-6"
          style={{ display: 'block', textAlign: 'center', textDecoration: 'none' }}
        >
          ← Tilbake til arrangementskode
        </Link>
      </div>
    </div>
  );
}
