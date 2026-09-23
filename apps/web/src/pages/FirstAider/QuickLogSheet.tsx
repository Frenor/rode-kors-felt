/**
 * QuickLogSheet
 *
 * "Behandlet på stedet" (gap A8 / item 8.28) — most field encounters never
 * need a patrol assignment or a hand-over: a blister gets a plaster and the
 * patient walks on. Making that a full "Meld pasient" + "Avslutt pasient"
 * round trip cost two forms for something that is over in a minute. This
 * sheet registers and closes the patient in one submit.
 */
import { useState } from 'react';
import { QUICK_LOG_COMPLAINTS, ageLabels } from '../../lib/constants';
import type { FieldTriageStatus } from '../../lib/constants';
import { TriageChips } from './TriageChips';
import { Button, Icon } from '../../components/ui';
import type { GeolocationState } from '../../hooks/useGeolocation';
import { GPS_STALE_AFTER_MS } from '../../hooks/useGeolocation';

const AGE_GROUP_OPTIONS = Object.keys(ageLabels) as Array<keyof typeof ageLabels>;

export interface QuickLogSubmitPayload {
  label: string;
  triageStatus: FieldTriageStatus;
  description: string | null;
  positionText: string | null;
  lat: number | null;
  lon: number | null;
  ageGroup: string;
}

export interface QuickLogSheetProps {
  gps: GeolocationState;
  initialPositionText: string;
  submitting: boolean;
  error: string;
  onSubmit: (payload: QuickLogSubmitPayload) => void;
  onClose: () => void;
}

export function QuickLogSheet({ gps, initialPositionText, submitting, error, onSubmit, onClose }: QuickLogSheetProps) {
  const [triage, setTriage] = useState<FieldTriageStatus>('green');
  const [complaintId, setComplaintId] = useState<string | null>(null);
  const [otherText, setOtherText] = useState('');
  const [note, setNote] = useState('');
  const [ageGroup, setAgeGroup] = useState<string>('adult');
  const [positionText, setPositionText] = useState(initialPositionText);

  const isOther = complaintId === 'other';
  const label = isOther
    ? otherText.trim()
    : (QUICK_LOG_COMPLAINTS.find((c) => c.id === complaintId)?.label ?? '');
  const canSubmit = !!label && !submitting;

  const gpsAgeMs = gps.updatedAt ? Date.now() - gps.updatedAt : null;
  const gpsIsStale = gpsAgeMs !== null && gpsAgeMs > GPS_STALE_AFTER_MS;

  const handleSubmit = () => {
    if (!canSubmit) return;
    onSubmit({
      label,
      triageStatus: triage,
      description: note.trim() || null,
      positionText: positionText.trim() || null,
      lat: gps.position?.lat ?? null,
      lon: gps.position?.lng ?? null,
      ageGroup,
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Behandlet på stedet"
      data-testid="firstaid-quick-log-sheet"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 'var(--z-modal)',
        background: 'rgba(0,0,0,0.55)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        overflowY: 'auto',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--color-surface)',
          borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0',
          padding: 'var(--space-4) var(--space-4) calc(var(--space-4) + env(safe-area-inset-bottom, 0px))',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-4)',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 700, fontSize: 'var(--text-lg)' }}>Behandlet på stedet</span>
          <Button variant="ghost" iconOnly icon="x" onClick={onClose} aria-label="Lukk" />
        </div>

        {/* Triage — green preselected: most quick-log cases are minor. */}
        <div>
          <div className="section-label" style={{ marginBottom: 'var(--space-2)' }}>Triagefarge</div>
          <TriageChips value={triage} onChange={setTriage} idPrefix="firstaid-quick-log-triage" />
        </div>

        {/* Complaint chips — the label the patient gets. */}
        <div>
          <div className="section-label" style={{ marginBottom: 'var(--space-2)' }}>Hva gjelder det?</div>
          <div
            role="radiogroup"
            aria-label="Hva gjelder det"
            style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}
          >
            {QUICK_LOG_COMPLAINTS.map((c) => {
              const active = complaintId === c.id;
              return (
                <Button
                  key={c.id}
                  variant="secondary"
                  role="radio"
                  aria-checked={active}
                  data-testid={`firstaid-quick-log-complaint-${c.id}`}
                  onClick={() => setComplaintId((prev) => (prev === c.id ? null : c.id))}
                  style={{ fontWeight: active ? 700 : 500 }}
                >
                  {c.label}
                </Button>
              );
            })}
          </div>
          {isOther && (
            <input
              className="field"
              value={otherText}
              onChange={(e) => setOtherText(e.target.value)}
              placeholder="Beskriv kort hva det gjelder…"
              aria-label="Beskriv hva det gjelder"
              style={{ marginTop: 'var(--space-2)' }}
            />
          )}
        </div>

        {/* Optional note */}
        <div>
          <label htmlFor="quick-log-note" className="section-label" style={{ display: 'block', marginBottom: 'var(--space-2)' }}>
            Notat (valgfritt)
          </label>
          <textarea
            id="quick-log-note"
            className="field"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Hva ble gjort?"
            rows={2}
            style={{ resize: 'none' }}
          />
        </div>

        {/* Age group — reuses the sick bay intake's values. */}
        <div>
          <label htmlFor="quick-log-age-group" className="section-label" style={{ display: 'block', marginBottom: 'var(--space-2)' }}>
            Aldersgruppe
          </label>
          <select
            id="quick-log-age-group"
            className="field"
            value={ageGroup}
            onChange={(e) => setAgeGroup(e.target.value)}
          >
            {AGE_GROUP_OPTIONS.map((value) => (
              <option key={value} value={value}>{ageLabels[value]}</option>
            ))}
          </select>
        </div>

        {/* Position — same free-text + GPS pattern as "Meld pasient". */}
        <div>
          <label htmlFor="quick-log-position-text" className="section-label" style={{ display: 'block', marginBottom: 'var(--space-2)' }}>
            Hvor er pasienten?
          </label>
          <input
            id="quick-log-position-text"
            className="field"
            value={positionText}
            onChange={(e) => setPositionText(e.target.value)}
            placeholder="f.eks. Sektor B, ved drikkestasjon 3"
          />
        </div>
        <div
          data-testid="quick-log-gps-status"
          style={{
            display: 'flex', gap: 'var(--space-2)', alignItems: 'flex-start',
            fontSize: 'var(--text-sm)',
            color: gps.position && !gpsIsStale ? 'var(--color-text-muted)' : 'var(--color-status-warning)',
          }}
        >
          <Icon name={gps.position && !gpsIsStale ? 'pin' : 'alert'} style={{ marginTop: 2 }} />
          <span>
            {gps.position
              ? 'GPS-posisjon legges ved automatisk'
              : gps.status === 'denied'
                ? 'Posisjonstilgang er avslått — beskriv hvor pasienten er.'
                : gps.status === 'acquiring'
                  ? 'Henter GPS-posisjon… beskriv gjerne stedet i tillegg.'
                  : 'Ingen GPS-posisjon — beskriv hvor pasienten er.'}
          </span>
        </div>

        {error && (
          <div role="alert" style={{ fontSize: 'var(--text-sm)', color: 'var(--color-status-critical)', fontWeight: 600 }}>
            {error}
          </div>
        )}

        <Button
          variant="primary"
          size="xl"
          block
          disabled={!canSubmit}
          data-testid="firstaid-quick-log-submit"
          onClick={handleSubmit}
        >
          {submitting ? 'Loggfører…' : 'Loggfør'}
        </Button>
      </div>
    </div>
  );
}
