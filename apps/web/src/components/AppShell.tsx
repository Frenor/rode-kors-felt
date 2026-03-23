import { useState, useEffect, type ReactNode } from 'react';
import { useAuthStore } from '../stores/auth';
import { useWsStore } from '../stores/ws';
import { useOfflineSync } from '../hooks/useOfflineSync';
import { useNavigate } from 'react-router-dom';
import { ToastContainer } from './ToastContainer';
import { DemoBanner } from './DemoBanner';
import { DemoWalkthrough } from './DemoWalkthrough';
import { useLiveQuery } from 'dexie-react-hooks';
import { offlineQueueDb } from '../lib/offline-queue';

const IS_DEMO =
  import.meta.env.VITE_DEMO_MODE === 'true' ||
  (typeof window !== 'undefined' &&
    (new URLSearchParams(window.location.search).has('demo') ||
      sessionStorage.getItem('rkf-demo') === '1'));

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const { role, eventName, logout, accessToken } = useAuthStore();
  const { connect, disconnect, status: wsStatus } = useWsStore();
  const navigate = useNavigate();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [theme, setTheme] = useState<'auto' | 'light' | 'dark'>('auto');

  // Offline sync for first aiders
  useOfflineSync();

  // Pending queue count for banner
  const queueCount = useLiveQuery(
    () => offlineQueueDb.queue.where('status').equals('pending').count(),
    [],
    0,
  );

  // Connect WebSocket for all authenticated roles
  useEffect(() => {
    if (accessToken) connect(accessToken);
    return () => disconnect();
  }, [accessToken, connect, disconnect]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (theme === 'auto') {
      document.documentElement.removeAttribute('data-theme');
    } else {
      document.documentElement.setAttribute('data-theme', theme);
    }
  }, [theme]);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const roleLabels: Record<string, string> = {
    first_aider: 'Førstehjelper',
    sickbay: 'Sykestue',
    coordinator: 'Koordinator',
  };

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      {/* Demo banner — shown above everything when in demo mode */}
      {IS_DEMO && <DemoBanner eventName={eventName ?? 'Holmenkollen Skimaraton 2026'} />}
      {/* Top bar */}
      <header
        role="banner"
        style={{
          background: 'var(--color-surface)',
          borderBottom: '1px solid var(--color-border)',
          padding: '0 var(--space-4)',
          height: '56px',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-4)',
          position: 'sticky',
          top: 0,
          zIndex: 'var(--z-sticky)',
        }}
      >
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <div
            aria-hidden="true"
            style={{
              width: 28, height: 28,
              background: 'var(--color-brand)',
              borderRadius: 'var(--radius-sm)',
              position: 'relative',
              flexShrink: 0,
            }}
          >
            <div style={{
              position: 'absolute', width: 6, height: 16,
              background: 'white', borderRadius: 1,
              top: 6, left: 11,
            }} />
            <div style={{
              position: 'absolute', width: 16, height: 6,
              background: 'white', borderRadius: 1,
              top: 11, left: 6,
            }} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 'var(--text-sm)', letterSpacing: 'var(--tracking-wide)' }}>
              RKF
            </div>
            <div style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--text-xs)',
              color: 'var(--color-text-muted)',
            }}>
              {roleLabels[role || ''] || role}
            </div>
          </div>
        </div>

        {/* Event name */}
        {eventName && (
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--text-xs)',
            color: 'var(--color-text-subtle)',
            marginLeft: 'var(--space-2)',
          }}>
            {eventName}
          </span>
        )}

        <div style={{ flex: 1 }} />

        {/* Connection indicator */}
        {(() => {
          const connected = isOnline && wsStatus === 'connected';
          const reconnecting = isOnline && wsStatus === 'reconnecting';
          const color = connected
            ? 'var(--color-status-ok)'
            : reconnecting
              ? 'var(--color-status-warning)'
              : 'var(--color-status-critical)';
          const label = connected
            ? 'Tilkoblet'
            : reconnecting
              ? 'Kobler til…'
              : 'Frakoblet';
          return (
            <div
              role="status"
              aria-live="polite"
              aria-label={label}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--text-xs)',
                color,
              }}
            >
              <div style={{
                width: 8, height: 8,
                borderRadius: 'var(--radius-full)',
                background: color,
              }} />
              {label}
            </div>
          );
        })()}

        {/* Theme toggle */}
        <div role="group" aria-label="Temavalg" style={{ display: 'flex', gap: 2 }}>
          {(['light', 'auto', 'dark'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTheme(t)}
              aria-pressed={theme === t}
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--text-xs)',
                padding: '4px 8px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--color-border)',
                background: theme === t ? 'var(--color-surface-raised)' : 'transparent',
                color: theme === t ? 'var(--color-text)' : 'var(--color-text-subtle)',
                cursor: 'pointer',
              }}
            >
              {t === 'light' ? '☀' : t === 'dark' ? '☾' : 'Auto'}
            </button>
          ))}
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--text-xs)',
            padding: '6px 12px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--color-border)',
            background: 'transparent',
            color: 'var(--color-text-muted)',
            cursor: 'pointer',
          }}
        >
          Logg ut
        </button>
      </header>

      {/* Network offline banner */}
      {!isOnline && (
        <div
          role="alert"
          aria-live="assertive"
          style={{
            background: 'var(--color-status-warning-bg)',
            borderBottom: '1px solid var(--color-status-warning-border)',
            padding: 'var(--space-2) var(--space-4)',
            textAlign: 'center',
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--text-sm)',
            color: 'var(--color-status-warning)',
          }}
        >
          Frakoblet — hendelser lagres lokalt og synkroniseres når tilkoblingen er tilbake
          {queueCount > 0 && ` (${queueCount} i kø)`}
        </div>
      )}

      {/* WebSocket reconnecting banner (shown when online but WS dropped) */}
      {isOnline && wsStatus === 'reconnecting' && (
        <div
          role="status"
          aria-live="polite"
          style={{
            background: 'var(--color-status-warning-bg)',
            borderBottom: '1px solid var(--color-status-warning-border)',
            padding: 'var(--space-2) var(--space-4)',
            textAlign: 'center',
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--text-sm)',
            color: 'var(--color-status-warning)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 'var(--space-2)',
          }}
        >
          <span
            aria-hidden="true"
            style={{
              width: 8, height: 8,
              borderRadius: 'var(--radius-full)',
              background: 'var(--color-status-warning)',
              animation: 'pulse 1.5s ease-in-out infinite',
              flexShrink: 0,
            }}
          />
          Gjenoppretter sanntidsforbindelsen — siste data kan mangle
        </div>
      )}

      {/* Main content */}
      <main
        id="main-content"
        style={{
          flex: 1,
          padding: 'var(--space-4)',
          maxWidth: role === 'coordinator' ? '1440px' : '768px',
          width: '100%',
          margin: '0 auto',
        }}
      >
        {children}
      </main>

      <ToastContainer />
      {/* Demo walkthrough guide — floating bottom-right */}
      {IS_DEMO && <DemoWalkthrough role={role} />}
    </div>
  );
}
