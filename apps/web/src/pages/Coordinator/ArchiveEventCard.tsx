/**
 * ArchiveEventCard — retention (gap B8 / item 8.33): three steps in one
 * card, in order, each gating the next. Anonymising is irreversible, so it
 * needs both an export already taken and the event name typed exactly, and
 * the API itself refuses it (409) while the event is still active.
 */
import { useState } from 'react';
import { Button } from '../../components/ui';

interface ArchiveEventCardProps {
  eventName: string;
  eventStatus?: string | null;
  /** Already anonymised (e.g. page reloaded after a previous run) — skips straight to the result. */
  anonymisedAt?: string | null;
  /** Fetches the journals and downloads them; resolves with how many were exported. */
  onExportJournals: () => Promise<number>;
  onAnonymise: () => Promise<{ anonymisedAt: string; alreadyAnonymised: boolean; patientsAnonymised: number }>;
}

function fmtClock(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' });
}

export function ArchiveEventCard({ eventName, eventStatus, anonymisedAt, onExportJournals, onAnonymise }: ArchiveEventCardProps) {
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportedCount, setExportedCount] = useState<number | null>(null);

  const [confirmText, setConfirmText] = useState('');

  const [anonymising, setAnonymising] = useState(false);
  const [anonymiseError, setAnonymiseError] = useState<string | null>(null);
  const [result, setResult] = useState<{ anonymisedAt: string; patientsAnonymised: number } | null>(
    anonymisedAt ? { anonymisedAt, patientsAnonymised: 0 } : null,
  );

  const step1Done = exportedCount !== null;
  const step2Done = confirmText.trim() === eventName.trim() && eventName.trim().length > 0;
  const isActive = eventStatus === 'active';
  const alreadyDone = Boolean(result);

  const handleExport = async () => {
    setExporting(true);
    setExportError(null);
    try {
      const count = await onExportJournals();
      setExportedCount(count);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Kunne ikke eksportere journaler');
    } finally {
      setExporting(false);
    }
  };

  const handleAnonymise = async () => {
    setAnonymising(true);
    setAnonymiseError(null);
    try {
      const res = await onAnonymise();
      setResult({ anonymisedAt: res.anonymisedAt, patientsAnonymised: res.patientsAnonymised });
    } catch (err) {
      setAnonymiseError(err instanceof Error ? err.message : 'Kunne ikke anonymisere arrangementet');
    } finally {
      setAnonymising(false);
    }
  };

  return (
    <section
      aria-labelledby="archive-event-title"
      data-testid="archive-event-card"
      className="card card--critical"
      style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-4)' }}
    >
      <h2 id="archive-event-title" className="section-label" style={{ margin: '0 0 var(--space-1)', color: 'var(--color-status-critical)' }}>
        Avslutt og arkiver arrangementet
      </h2>
      <p style={{ margin: '0 0 var(--space-3)', fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
        Fjerner navn, fødselsdato, kjønn og fritekst fra alle pasienter i arrangementet. Kan ikke angres.
      </p>

      {alreadyDone ? (
        <p data-testid="archive-result" style={{ margin: 0, fontSize: 'var(--text-base)', fontWeight: 700, color: 'var(--color-status-ok)' }}>
          {`Anonymisert kl. ${fmtClock(result!.anonymisedAt)}${result!.patientsAnonymised ? ` · ${result!.patientsAnonymised} pasienter` : ''}`}
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <span className="section-label">1. Eksporter journaler</span>
              {step1Done && <span style={{ color: 'var(--color-status-ok)', fontSize: 'var(--text-xs)', fontWeight: 700 }}>✓ Gjort</span>}
            </div>
            <Button
              variant="secondary"
              size="sm"
              icon="download"
              disabled={exporting}
              data-testid="archive-export"
              onClick={() => void handleExport()}
              style={{ marginTop: 'var(--space-1)' }}
            >
              {exporting ? 'Eksporterer…' : 'Eksporter journaler'}
            </Button>
            {exportedCount !== null && (
              <p style={{ margin: 'var(--space-1) 0 0', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                {exportedCount} {exportedCount === 1 ? 'journal' : 'journaler'} eksportert
              </p>
            )}
            {exportError && (
              <p role="alert" style={{ margin: 'var(--space-1) 0 0', fontSize: 'var(--text-sm)', color: 'var(--color-status-critical)' }}>{exportError}</p>
            )}
          </div>

          <div>
            <label htmlFor="archive-confirm-input" className="section-label" style={{ display: 'block', marginBottom: 4 }}>
              {`2. Skriv inn arrangementets navn for å bekrefte ("${eventName}")`}
            </label>
            <input
              id="archive-confirm-input"
              data-testid="archive-confirm-input"
              className="field"
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={eventName}
              style={{ minHeight: 44, maxWidth: 320 }}
            />
          </div>

          <div>
            <span className="section-label">3. Anonymiser</span>
            {isActive && (
              <p style={{ margin: 'var(--space-1) 0', fontSize: 'var(--text-sm)', color: 'var(--color-status-warning)' }}>
                Arrangementet er fortsatt aktivt — sett status til avsluttet eller arkivert i Arrangement-seksjonen først.
              </p>
            )}
            <Button
              variant="danger"
              size="sm"
              disabled={!step1Done || !step2Done || isActive || anonymising}
              data-testid="archive-anonymise"
              onClick={() => void handleAnonymise()}
              style={{ marginTop: 'var(--space-1)' }}
            >
              {anonymising ? 'Anonymiserer…' : 'Anonymiser arrangementet'}
            </Button>
            {anonymiseError && (
              <p role="alert" style={{ margin: 'var(--space-1) 0 0', fontSize: 'var(--text-sm)', color: 'var(--color-status-critical)' }}>{anonymiseError}</p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
