import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../stores/auth';
import type { TeamTransport } from '../stores/auth';
import { api } from '../lib/api';

export function CodeEntryPage() {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) return;

    setLoading(true);
    setError('');

    try {
      const res = await api.redeemCode(code);
      login({
        accessToken: res.accessToken,
        refreshToken: res.refreshToken,
        role: res.role,
        eventId: res.eventId,
        eventName: res.eventName,
        teams: res.teams as Array<{ id: string; name: string; transport?: TeamTransport }>,
      });
      const dest =
        res.role === 'sickbay' ? '/sickbay' :
        res.role === 'coordinator' ? '/coordinator' :
        '/firstaid';
      navigate(dest);
    } catch (err: any) {
      setError(err.message || 'Ugyldig kode');
    } finally {
      setLoading(false);
    }
  };

  const handleDigit = (digit: string) => {
    if (code.length < 6) {
      setCode((prev) => prev + digit);
      setError('');
    }
  };

  const handleBackspace = () => {
    setCode((prev) => prev.slice(0, -1));
    setError('');
  };

  return (
    <div
      className="page-center flex-col"
    >
      {/* Logo */}
      <div style={{ textAlign: 'center', marginBottom: 'var(--space-8)' }}>
        <div
          aria-hidden="true"
          style={{
            width: 56, height: 56,
            background: 'var(--color-brand)',
            borderRadius: 'var(--radius-md)',
            margin: '0 auto var(--space-4)',
            position: 'relative',
          }}
        >
          <div style={{
            position: 'absolute', width: 10, height: 28,
            background: 'white', borderRadius: 2, top: 14, left: 23,
          }} />
          <div style={{
            position: 'absolute', width: 28, height: 10,
            background: 'white', borderRadius: 2, top: 23, left: 14,
          }} />
        </div>
        <h1 className="text-xl fw-700">
          Rødt Kors Felt
        </h1>
        <p className="mono-sm text-muted mt-2">
          Tast inn arrangementskoden
        </p>
      </div>

      <form onSubmit={handleSubmit} style={{ width: '100%', maxWidth: 360 }}>
        {/* Code display */}
        <div
          role="status"
          aria-live="polite"
          aria-label={`Kode: ${code || 'Tom'}`}
          className="flex gap-2 mb-6"
          style={{ justifyContent: 'center' }}
        >
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              style={{
                width: 48, height: 56,
                borderRadius: 'var(--radius-md)',
                border: `2px solid ${i === code.length ? 'var(--color-focus-ring)' : code[i] ? 'var(--color-brand)' : 'var(--color-border)'}`,
                background: 'var(--color-input-bg)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--text-2xl)',
                fontWeight: 600,
                color: 'var(--color-text)',
                transition: 'border-color var(--duration-fast) var(--ease-default)',
              }}
            >
              {code[i] || ''}
            </div>
          ))}
        </div>

        {/* Error message */}
        {error && (
          <div
            role="alert"
            style={{
              textAlign: 'center',
              color: 'var(--color-status-critical)',
              fontSize: 'var(--text-sm)',
              marginBottom: 'var(--space-4)',
              fontWeight: 500,
            }}
          >
            {error}
          </div>
        )}

        {/* Numpad — glove-friendly 56px+ targets */}
        <div
          role="group"
          aria-label="Talltastatur for arrangementskode"
          className="grid-3 mb-4"
        >
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'back'].map((key) => {
            if (key === '') return <div key="empty" />;
            if (key === 'back') {
              return (
                <button
                  key="back"
                  type="button"
                  onClick={handleBackspace}
                  aria-label="Slett siste siffer"
                  className="touch-target"
                  style={{
                    height: 'var(--touch-comfortable)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)',
                    background: 'var(--color-surface)',
                    color: 'var(--color-text-muted)',
                    fontSize: 'var(--text-lg)',
                    cursor: 'pointer',
                  }}
                >
                  ←
                </button>
              );
            }
            return (
              <button
                key={key}
                type="button"
                onClick={() => handleDigit(key)}
                disabled={code.length >= 6}
                className="touch-target"
                style={{
                  height: 'var(--touch-comfortable)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-surface)',
                  color: 'var(--color-text)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 'var(--text-xl)',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {key}
              </button>
            );
          })}
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={code.length !== 6 || loading}
          className="touch-target"
          style={{
            width: '100%',
            height: 'var(--touch-min)',
            borderRadius: 'var(--radius-md)',
            border: 'none',
            background: code.length === 6 ? 'var(--color-brand)' : 'var(--color-border)',
            color: code.length === 6 ? 'white' : 'var(--color-text-subtle)',
            fontFamily: 'var(--font-sans)',
            fontSize: 'var(--text-base)',
            fontWeight: 600,
            cursor: code.length === 6 ? 'pointer' : 'not-allowed',
            transition: 'background var(--duration-fast) var(--ease-default)',
          }}
        >
          {loading ? 'Logger inn...' : 'Koble til arrangement'}
        </button>
      </form>

      {/* Demo mode hint */}
      {import.meta.env.VITE_DEMO_MODE === 'true' && (
        <div
          className="card-p3 mono-xs-muted mt-6"
          style={{ textAlign: 'center', lineHeight: 1.6 }}
        >
          Demo-modus &mdash; bruk kode<br />
          <strong>123456</strong> (førstehjelper) &nbsp;·&nbsp; <strong>654321</strong> (sykestue)
        </div>
      )}

      {/* Admin login link */}
      <Link
        to="/login"
        className="mono-xs-subtle mt-8"
        style={{ textDecoration: 'none' }}
      >
        Koordinator / Admin innlogging →
      </Link>
    </div>
  );
}
