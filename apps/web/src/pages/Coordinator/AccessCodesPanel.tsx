/**
 * AccessCodesPanel — event set-up (gap B5 / item 8.31): generate, show once
 * and revoke role access codes. A fresh code is shown large, in mono, with a
 * copy button and a QR encoding the app URL plus `?code=<code>` — the app
 * itself may ignore the query today, but encoding it costs nothing and saves
 * a manual digit-by-digit read for whoever scans it.
 */
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { toCanvas } from 'qrcode';
import { Button } from '../../components/ui';
import type { AccessCode } from '../../lib/types';

const ROLE_LABELS: Record<AccessCode['role'], string> = {
  admin: 'Admin',
  coordinator: 'Koordinator',
  sickbay: 'Sykestue',
  first_aider: 'Førstehjelper',
};

const CREATABLE_ROLES: Array<{ value: 'first_aider' | 'sickbay' | 'coordinator'; label: string }> = [
  { value: 'first_aider', label: 'Førstehjelper' },
  { value: 'sickbay', label: 'Sykestue' },
  { value: 'coordinator', label: 'Koordinator' },
];

function fmtDateTime(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('nb-NO', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function appUrlWithCode(code: string): string {
  const base = typeof window === 'undefined' ? '' : `${window.location.origin}${import.meta.env.BASE_URL ?? '/'}`;
  return `${base}?code=${code}`;
}

interface AccessCodesPanelProps {
  codes: AccessCode[];
  onCreateCode: (data: { role: 'first_aider' | 'sickbay' | 'coordinator'; hours?: number }) => Promise<AccessCode>;
  onRevokeCode: (codeId: string) => Promise<void>;
}

export function AccessCodesPanel({ codes, onCreateCode, onRevokeCode }: AccessCodesPanelProps) {
  const [role, setRole] = useState<'first_aider' | 'sickbay' | 'coordinator'>('first_aider');
  const [hours, setHours] = useState('24');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [freshCode, setFreshCode] = useState<AccessCode | null>(null);
  const [copied, setCopied] = useState(false);
  const [copyFallback, setCopyFallback] = useState(false);
  const [qrError, setQrError] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<Record<string, boolean>>({});
  const [revokeError, setRevokeError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!freshCode || !canvasRef.current) return;
    setQrError(null);
    toCanvas(canvasRef.current, appUrlWithCode(freshCode.code), { width: 160, margin: 1 }).catch((err) => {
      setQrError(err instanceof Error ? err.message : 'Kunne ikke tegne QR-kode');
    });
  }, [freshCode]);

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    setCreating(true);
    setCreateError(null);
    setCopied(false);
    setCopyFallback(false);
    try {
      const parsedHours = hours.trim() ? Number(hours) : undefined;
      const code = await onCreateCode({ role, hours: parsedHours });
      setFreshCode(code);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Kunne ikke opprette kode');
    } finally {
      setCreating(false);
    }
  };

  const handleCopy = async () => {
    if (!freshCode) return;
    try {
      await navigator.clipboard.writeText(freshCode.code);
      setCopied(true);
      setCopyFallback(false);
    } catch {
      // No clipboard access (permissions, non-secure context, older browser) —
      // the code is already shown large and selectable, so fall back to that.
      setCopyFallback(true);
    }
  };

  const handleRevoke = async (codeId: string) => {
    setRevoking((prev) => ({ ...prev, [codeId]: true }));
    setRevokeError(null);
    try {
      await onRevokeCode(codeId);
    } catch (err) {
      setRevokeError(err instanceof Error ? err.message : 'Kunne ikke trekke tilbake koden');
    } finally {
      setRevoking((prev) => {
        const next = { ...prev };
        delete next[codeId];
        return next;
      });
    }
  };

  return (
    <section
      aria-labelledby="access-codes-title"
      data-testid="event-setup-access-codes"
      className="card"
      style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-4)' }}
    >
      <h2 id="access-codes-title" className="section-label" style={{ margin: '0 0 var(--space-3)' }}>
        Tilgangskoder
      </h2>

      <form onSubmit={(e) => void handleCreate(e)} style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', alignItems: 'flex-end', marginBottom: 'var(--space-3)' }}>
        <div>
          <label htmlFor="access-code-role" className="section-label" style={{ display: 'block', marginBottom: 4 }}>Rolle</label>
          <select
            id="access-code-role"
            className="field"
            value={role}
            onChange={(e) => setRole(e.target.value as typeof role)}
            style={{ minHeight: 44 }}
          >
            {CREATABLE_ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="access-code-hours" className="section-label" style={{ display: 'block', marginBottom: 4 }}>Gyldig i timer</label>
          <input
            id="access-code-hours"
            type="number"
            min={1}
            max={168}
            className="field"
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            style={{ minHeight: 44, width: 100 }}
          />
        </div>
        <Button type="submit" variant="secondary" icon="plus" disabled={creating} data-testid="event-setup-code-create">
          {creating ? 'Oppretter…' : 'Ny kode'}
        </Button>
      </form>
      {createError && (
        <p role="alert" style={{ margin: '0 0 var(--space-3)', fontSize: 'var(--text-sm)', color: 'var(--color-status-critical)' }}>{createError}</p>
      )}

      {freshCode && (
        <div
          data-testid="event-setup-code-fresh"
          style={{
            display: 'flex', flexWrap: 'wrap', gap: 'var(--space-4)', alignItems: 'center',
            padding: 'var(--space-3)', marginBottom: 'var(--space-3)',
            border: '1px solid var(--color-status-ok-border)', background: 'var(--color-status-ok-bg)',
            borderRadius: 'var(--radius-md)',
          }}
        >
          <div>
            <div className="section-label" style={{ marginBottom: 4 }}>
              Ny kode — {ROLE_LABELS[freshCode.role]} (vis kun nå)
            </div>
            <div data-testid="event-setup-code-value" className="data" style={{ fontSize: 'var(--text-3xl)', fontWeight: 700, letterSpacing: '0.1em' }}>
              {freshCode.code}
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', marginTop: 'var(--space-2)' }}>
              <Button variant="secondary" size="sm" icon="copy" onClick={() => void handleCopy()}>
                {copied ? 'Kopiert!' : 'Kopier'}
              </Button>
              {copyFallback && (
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                  Kunne ikke kopiere automatisk — marker koden over manuelt.
                </span>
              )}
            </div>
          </div>
          <div>
            <canvas ref={canvasRef} width={160} height={160} data-testid="event-setup-code-qr" style={{ background: 'white', borderRadius: 'var(--radius-sm)' }} />
            {qrError && <p role="alert" style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--color-status-critical)' }}>{qrError}</p>}
          </div>
        </div>
      )}

      {revokeError && (
        <p role="alert" style={{ margin: '0 0 var(--space-2)', fontSize: 'var(--text-sm)', color: 'var(--color-status-critical)' }}>{revokeError}</p>
      )}

      {codes.length === 0 ? (
        <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--color-text-subtle)' }}>Ingen tilgangskoder opprettet ennå.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--color-border)' }}>
              <th style={{ padding: 'var(--space-1) var(--space-2)' }}>Rolle</th>
              <th style={{ padding: 'var(--space-1) var(--space-2)' }}>Kode</th>
              <th style={{ padding: 'var(--space-1) var(--space-2)' }}>Utløper</th>
              <th style={{ padding: 'var(--space-1) var(--space-2)' }}>Status</th>
              <th style={{ padding: 'var(--space-1) var(--space-2)' }} />
            </tr>
          </thead>
          <tbody>
            {[...codes].sort((a, b) => b.expiresAt.localeCompare(a.expiresAt)).map((code) => (
              <tr key={code.id} data-testid={`event-setup-code-${code.id}`} style={{ borderBottom: '1px solid var(--color-border)' }}>
                <td style={{ padding: 'var(--space-1) var(--space-2)' }}>{ROLE_LABELS[code.role]}</td>
                <td className="data" style={{ padding: 'var(--space-1) var(--space-2)' }}>••••••</td>
                <td className="data" style={{ padding: 'var(--space-1) var(--space-2)' }}>{fmtDateTime(code.expiresAt)}</td>
                <td style={{ padding: 'var(--space-1) var(--space-2)' }}>
                  {code.revokedAt ? (
                    <span style={{ color: 'var(--color-text-subtle)' }}>Trukket tilbake</span>
                  ) : new Date(code.expiresAt).getTime() < Date.now() ? (
                    <span style={{ color: 'var(--color-text-subtle)' }}>Utløpt</span>
                  ) : (
                    <span style={{ color: 'var(--color-status-ok)' }}>Aktiv</span>
                  )}
                </td>
                <td style={{ padding: 'var(--space-1) var(--space-2)' }}>
                  {!code.revokedAt && (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={!!revoking[code.id]}
                      data-testid={`event-setup-code-revoke-${code.id}`}
                      onClick={() => void handleRevoke(code.id)}
                    >
                      {revoking[code.id] ? 'Trekker tilbake…' : 'Trekk tilbake'}
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
