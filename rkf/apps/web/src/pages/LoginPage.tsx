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
      style={{
        minHeight: '100dvh',
        background: 'var(--color-bg)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-6)',
      }}
    >
      <div style={{ width: '100%', maxWidth: 400 }}>
        <h1 style={{ fontSize: 'var(--text-xl)', fontWeight: 700, marginBottom: 'var(--space-2)' }}>
          Koordinator-innlogging
        </h1>
        <p style={{
          color: 'var(--color-text-muted)',
          fontSize: 'var(--text-sm)',
          marginBottom: 'var(--space-6)',
        }}>
          For koordinatorer og administratorer
        </p>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <label
              htmlFor="email"
              style={{
                display: 'block',
                fontSize: 'var(--text-sm)',
                fontWeight: 500,
                marginBottom: 'var(--space-1)',
                color: 'var(--color-text)',
              }}
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
              style={{
                width: '100%',
                height: 'var(--touch-min)',
                padding: '0 var(--space-4)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-input-border)',
                background: 'var(--color-input-bg)',
                color: 'var(--color-text)',
                fontFamily: 'var(--font-sans)',
                fontSize: 'var(--text-base)',
              }}
            />
          </div>

          <div style={{ marginBottom: 'var(--space-6)' }}>
            <label
              htmlFor="password"
              style={{
                display: 'block',
                fontSize: 'var(--text-sm)',
                fontWeight: 500,
                marginBottom: 'var(--space-1)',
                color: 'var(--color-text)',
              }}
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
              style={{
                width: '100%',
                height: 'var(--touch-min)',
                padding: '0 var(--space-4)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-input-border)',
                background: 'var(--color-input-bg)',
                color: 'var(--color-text)',
                fontFamily: 'var(--font-sans)',
                fontSize: 'var(--text-base)',
              }}
            />
          </div>

          {error && (
            <div role="alert" style={{
              color: 'var(--color-status-critical)',
              fontSize: 'var(--text-sm)',
              marginBottom: 'var(--space-4)',
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
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
          style={{
            display: 'block',
            textAlign: 'center',
            marginTop: 'var(--space-6)',
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--text-xs)',
            color: 'var(--color-text-subtle)',
            textDecoration: 'none',
          }}
        >
          ← Tilbake til arrangementskode
        </Link>
      </div>
    </div>
  );
}
