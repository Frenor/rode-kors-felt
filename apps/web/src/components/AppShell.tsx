import { useState, useEffect, type ReactNode } from 'react';
import { useAuthStore } from '../stores/auth';
import { useWsStore } from '../stores/ws';
import { useOfflineTeamSync } from '../hooks/useOfflineTeamSync';
import { useNavigate } from 'react-router-dom';
import { ToastContainer } from './ToastContainer';
import { DemoBanner } from './DemoBanner';
import { DemoWalkthrough } from './DemoWalkthrough';
import { applyTheme, nextTheme, persistTheme, readStoredTheme, THEME_LABELS, type ThemeChoice } from '../lib/theme';
import { Button } from './ui';

const IS_DEMO =
  import.meta.env.VITE_DEMO_MODE === 'true' ||
  (typeof window !== 'undefined' &&
    (new URLSearchParams(window.location.search).has('demo') ||
      sessionStorage.getItem('rkf-demo') === '1'));

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const { role, eventName, logout, accessToken, eventId } = useAuthStore();
  const { connect, disconnect, status: wsStatus } = useWsStore();
  const navigate = useNavigate();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  // Remembered across PWA restarts — a patrol that picked dark mode at dusk
  // must not get a white screen back after the phone killed the app.
  const [theme, setTheme] = useState<ThemeChoice>(readStoredTheme);

  // Offline sync for first aiders
  useOfflineTeamSync();

  // Connect WebSocket for all authenticated roles. Demo mode is served from
  // the in-memory demo store and must never dial a real backend: a dev API on
  // the proxied port would reject the demo token, trigger a refresh, and log
  // the demo session out.
  useEffect(() => {
    if (IS_DEMO) return;
    if (accessToken) connect(accessToken, eventId);
    return () => disconnect();
  }, [accessToken, eventId, connect, disconnect]);

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
    applyTheme(theme);
    persistTheme(theme);
  }, [theme]);

  // Archive flow (gap B8 / item 8.33) — a device that logs out must not keep
  // another role's offline queue or pending-assignment banners around for
  // whoever logs in next. Deleted by name (not by importing the queue
  // modules) so this works regardless of which roles' queues actually exist
  // on this device, and each failure is logged rather than silently eaten.
  const clearOfflineState = () => {
    try {
      indexedDB.deleteDatabase('rkf-firstaid-queue');
    } catch (err) {
      console.warn('[AppShell] Failed to clear first aider offline queue on logout', err);
    }
    try {
      indexedDB.deleteDatabase('rkf-sickbay-queue');
    } catch (err) {
      console.warn('[AppShell] Failed to clear sick bay offline queue on logout', err);
    }
    try {
      const keys: string[] = [];
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (key?.startsWith('rkf-pending-assignments:')) keys.push(key);
      }
      keys.forEach((key) => localStorage.removeItem(key));
    } catch (err) {
      console.warn('[AppShell] Failed to clear pending-assignment banners on logout', err);
    }
  };

  const handleLogout = () => {
    clearOfflineState();
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
          padding: '0 var(--space-3)',
          height: '56px',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
          position: 'sticky',
          top: 0,
          zIndex: 'var(--z-sticky)',
          overflow: 'hidden',
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexShrink: 0 }}>
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
              fontSize: 'var(--text-xs)',
              fontWeight: 600,
              color: 'var(--color-text-muted)',
            }}>
              {roleLabels[role || ''] || role}
            </div>
          </div>
        </div>

        {/* Event name */}
        {eventName && (
          <span className="app-header-event" style={{
            fontSize: 'var(--text-xs)',
            color: 'var(--color-text-subtle)',
            marginLeft: 'var(--space-2)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            minWidth: 0,
          }}>
            {eventName}
          </span>
        )}

        <div style={{ flex: 1 }} />

        {/* Connection indicator */}
        {(() => {
          const connected = isOnline && wsStatus === 'connected';
          const reconnecting = isOnline && wsStatus === 'reconnecting';
          const color = IS_DEMO
            ? 'var(--color-text-muted)'
            : connected
              ? 'var(--color-status-ok)'
              : reconnecting
                ? 'var(--color-status-warning)'
                : 'var(--color-status-critical)';
          const label = IS_DEMO
            ? 'Demo — uten sanntid'
            : connected
              ? 'Tilkoblet'
              : reconnecting
                ? 'Kobler til…'
                : 'Frakoblet';
          // The full label needs room; a phone header gets the short form.
          const visibleLabel = IS_DEMO ? 'Demo' : label;
          return (
            <div
              role="status"
              aria-live="polite"
              aria-label={label}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                fontSize: 'var(--text-xs)',
                fontWeight: 600,
                color,
                flexShrink: 0,
              }}
            >
              <div style={{
                width: 10, height: 10,
                borderRadius: 'var(--radius-full)',
                background: color,
                flexShrink: 0,
              }} />
              <span className="app-header-conn-label" title={label} style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{visibleLabel}</span>
            </div>
          );
        })()}

        {/* Theme toggle — cycles Auto → Mørk → Lys, remembered across restarts */}
        <Button
          size="sm"
          variant="secondary"
          icon={theme === 'dark' ? 'moon' : theme === 'light' ? 'sun' : 'autoTheme'}
          onClick={() => setTheme((current) => nextTheme(current))}
          aria-label={`Tema: ${THEME_LABELS[theme]} — trykk for å bytte`}
          title={`Tema: ${THEME_LABELS[theme]}`}
          data-testid="theme-toggle"
          style={{ flexShrink: 0 }}
        >
          <span className="app-header-btn-label">{THEME_LABELS[theme]}</span>
        </Button>

        {/* Logout — icon only on a phone, the label returns from tablet width */}
        <Button size="sm" variant="ghost" icon="logout" aria-label="Logg ut" onClick={handleLogout} style={{ flexShrink: 0 }}>
          <span className="app-header-btn-label">Logg ut</span>
        </Button>
      </header>

      {/* One status strip, only while something is degraded. Offline wins over a
          dropped realtime socket; the header dot and the team card carry the
          nominal state, so nothing sits between the header and the content
          when all is well (review X6). */}
      {(!isOnline || (!IS_DEMO && wsStatus === 'reconnecting')) && (
        <div
          role={!isOnline ? 'alert' : 'status'}
          aria-live={!isOnline ? 'assertive' : 'polite'}
          data-testid="connection-strip"
          style={{
            background: 'var(--color-status-warning-bg)',
            borderBottom: '1px solid var(--color-status-warning-border)',
            padding: 'var(--space-2) var(--space-4)',
            textAlign: 'center',
            fontSize: 'var(--text-sm)',
            fontWeight: 600,
            color: 'var(--color-status-warning)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 'var(--space-2)',
          }}
        >
          {isOnline && (
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
          )}
          {!isOnline
            ? 'Frakoblet — hendelser lagres lokalt og synkroniseres når tilkoblingen er tilbake'
            : 'Gjenoppretter sanntidsforbindelsen — siste data kan mangle'}
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
