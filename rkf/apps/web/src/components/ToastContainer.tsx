import { useEffect } from 'react';
import { useNotificationStore, type Toast } from '../stores/notifications';

const levelStyles: Record<Toast['level'], { color: string; bg: string; border: string }> = {
  info: {
    color: 'var(--color-status-info)',
    bg: 'var(--color-status-info-bg)',
    border: 'var(--color-status-info-border)',
  },
  warning: {
    color: 'var(--color-status-warning)',
    bg: 'var(--color-status-warning-bg)',
    border: 'var(--color-status-warning-border)',
  },
  urgent: {
    color: 'var(--color-status-critical)',
    bg: 'var(--color-status-critical-bg)',
    border: 'var(--color-status-critical-border)',
  },
};

function ToastItem({ toast }: { toast: Toast }) {
  const dismiss = useNotificationStore((s) => s.dismiss);
  const styles = levelStyles[toast.level];

  useEffect(() => {
    if (toast.autoDismissMs === 0) return;
    const timer = setTimeout(() => dismiss(toast.id), toast.autoDismissMs);
    return () => clearTimeout(timer);
  }, [toast.id, toast.autoDismissMs, dismiss]);

  return (
    <div
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 'var(--space-3)',
        padding: 'var(--space-3) var(--space-4)',
        borderRadius: 'var(--radius-md)',
        border: `1px solid ${styles.border}`,
        background: styles.bg,
        color: styles.color,
        fontFamily: 'var(--font-mono)',
        fontSize: 'var(--text-sm)',
        minWidth: 280,
        maxWidth: 400,
        boxShadow: 'var(--shadow-lg)',
      }}
    >
      <span style={{ flex: 1, lineHeight: 'var(--leading-normal)' }}>{toast.message}</span>
      <button
        aria-label="Lukk varsel"
        onClick={() => dismiss(toast.id)}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: styles.color,
          fontSize: 'var(--text-base)',
          padding: 0,
          lineHeight: 1,
          flexShrink: 0,
        }}
      >
        ×
      </button>
    </div>
  );
}

export function ToastContainer() {
  const toasts = useNotificationStore((s) => s.toasts);
  if (toasts.length === 0) return null;

  return (
    <div
      aria-label="Varsler"
      style={{
        position: 'fixed',
        bottom: 'var(--space-4)',
        right: 'var(--space-4)',
        zIndex: 'var(--z-toast)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-2)',
        alignItems: 'flex-end',
      }}
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </div>
  );
}
