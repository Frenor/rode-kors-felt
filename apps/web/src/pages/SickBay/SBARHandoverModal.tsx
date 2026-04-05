import { FocusTrap } from '../../components/FocusTrap';
import { formatPatientAge, GENDER_LABELS } from '../../lib/constants';
import type { SickBayPatient } from '../../lib/types';

export interface SbarFormShape {
  situation: string;
  background: string;
  assessment: string;
  recommendation: string;
  amkTidspunkt: string;
  amkReferanse: string;
  amkEta: string;
  amkFølger: string;
}

interface SBARHandoverModalProps {
  patient: SickBayPatient | null;
  form: SbarFormShape;
  onChange: (f: SbarFormShape) => void;
  onSubmit: () => void;
  onClose: () => void;
}

const SBAR_FIELDS = [
  { key: 'situation', label: 'S — Situasjon' },
  { key: 'background', label: 'B — Bakgrunn' },
  { key: 'assessment', label: 'A — Vurdering' },
  { key: 'recommendation', label: 'R — Anbefaling' },
] as const;

type SbarFieldKey = (typeof SBAR_FIELDS)[number]['key'];

export function SBARHandoverModal({ patient, form, onChange, onSubmit, onClose }: SBARHandoverModalProps) {
  const isDisabled = !form.situation || !form.background || !form.assessment || !form.recommendation;
  const patientName = patient?.fullName ?? patient?.presentingComplaint ?? 'Ukjent pasient';
  const patientAgeLabel = formatPatientAge({
    birthDate: patient?.birthDate ?? null,
    ageGroup: patient?.ageGroup ?? null,
    ageYears: patient?.ageYears ?? null,
  });
  const patientGenderLabel = patient?.gender ? GENDER_LABELS[patient.gender] : 'Kjønn ikke oppgitt';

  return (
    <div
      role="dialog"
      aria-label="SBAR-overlevering"
      aria-modal="true"
      style={{
        position: 'fixed', inset: 0, zIndex: 'var(--z-modal)',
        background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 'var(--space-4)',
      }}
    >
      <FocusTrap onEscape={onClose}>
        <div style={{
          background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-6)', maxWidth: 520, width: '100%',
        }}>
          <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, marginBottom: 'var(--space-1)' }}>
            SBAR-overlevering
          </h2>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-subtle)', marginBottom: 'var(--space-4)' }}>
            Alle felt må fylles ut før pasienten kan overføres.
          </p>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--color-text-subtle)', marginBottom: 'var(--space-4)' }}>
            Pasient: {patientName} · {patientAgeLabel} · {patientGenderLabel}
          </p>

          {SBAR_FIELDS.map(({ key, label }) => (
            <div key={key} style={{ marginBottom: 'var(--space-3)' }}>
              <label htmlFor={`sbar-${key}`} style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 'var(--space-1)' }}>
                {label}
              </label>
              <textarea
                id={`sbar-${key}`}
                value={form[key as SbarFieldKey]}
                onChange={(e) => onChange({ ...form, [key]: e.target.value })}
                rows={2}
                style={{
                  width: '100%', padding: 'var(--space-2)', borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-input-border)', background: 'var(--color-input-bg)',
                  color: 'var(--color-text)', fontSize: 'var(--text-sm)', resize: 'vertical',
                  fontFamily: 'inherit',
                }}
              />
            </div>
          ))}

          {/* AMK fields */}
          <div style={{ marginTop: 'var(--space-3)', marginBottom: 'var(--space-3)', padding: 'var(--space-3)', background: 'var(--color-surface-sunken)', borderRadius: 'var(--radius-md)' }}>
            <p style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--color-text-subtle)', marginBottom: 'var(--space-2)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              AMK (113) — valgfritt
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)' }}>
              <div>
                <label htmlFor="sbar-amk-tid" style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 500, marginBottom: 'var(--space-1)' }}>
                  Tidspunkt for AMK-samtale
                </label>
                <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
                  <input
                    id="sbar-amk-tid"
                    type="text"
                    value={form.amkTidspunkt}
                    onChange={(e) => onChange({ ...form, amkTidspunkt: e.target.value })}
                    style={{ flex: 1, height: 36, padding: '0 var(--space-2)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-input-border)', background: 'var(--color-input-bg)', color: 'var(--color-text)', fontSize: 'var(--text-xs)' }}
                  />
                  <button
                    type="button"
                    onClick={() => onChange({ ...form, amkTidspunkt: new Date().toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' }) })}
                    title="Sett til nå"
                    style={{ height: 36, padding: '0 var(--space-2)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-input-border)', background: 'var(--color-surface)', color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)', cursor: 'pointer', whiteSpace: 'nowrap' }}
                  >
                    Nå
                  </button>
                </div>
              </div>
              <div>
                <label htmlFor="sbar-amk-ref" style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 500, marginBottom: 'var(--space-1)' }}>
                  Ambulansenummer / AMK-referanse
                </label>
                <input
                  id="sbar-amk-ref"
                  type="text"
                  value={form.amkReferanse}
                  placeholder="f.eks. AMB-42"
                  onChange={(e) => onChange({ ...form, amkReferanse: e.target.value })}
                  style={{ width: '100%', height: 36, padding: '0 var(--space-2)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-input-border)', background: 'var(--color-input-bg)', color: 'var(--color-text)', fontSize: 'var(--text-xs)' }}
                />
              </div>
              <div>
                <label htmlFor="sbar-amk-eta" style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 500, marginBottom: 'var(--space-1)' }}>
                  Forventet ankomsttid (ETA)
                </label>
                <input
                  id="sbar-amk-eta"
                  type="text"
                  value={form.amkEta}
                  placeholder="f.eks. 14:35"
                  onChange={(e) => onChange({ ...form, amkEta: e.target.value })}
                  style={{ width: '100%', height: 36, padding: '0 var(--space-2)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-input-border)', background: 'var(--color-input-bg)', color: 'var(--color-text)', fontSize: 'var(--text-xs)' }}
                />
              </div>
              <div>
                <label htmlFor="sbar-amk-følger" style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 500, marginBottom: 'var(--space-1)' }}>
                  Hvem følger pasienten
                </label>
                <input
                  id="sbar-amk-følger"
                  type="text"
                  value={form.amkFølger}
                  placeholder="Navn / funksjon"
                  onChange={(e) => onChange({ ...form, amkFølger: e.target.value })}
                  style={{ width: '100%', height: 36, padding: '0 var(--space-2)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-input-border)', background: 'var(--color-input-bg)', color: 'var(--color-text)', fontSize: 'var(--text-xs)' }}
                />
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <button onClick={onClose} className="touch-target" style={{
              flex: 1, minHeight: 'var(--touch-min)', borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text)', cursor: 'pointer',
            }}>
              Avbryt
            </button>
            <button
              onClick={onSubmit}
              disabled={isDisabled}
              className="touch-target"
              style={{
                flex: 1, minHeight: 'var(--touch-min)', borderRadius: 'var(--radius-md)',
                border: 'none', background: 'var(--color-status-critical)', color: 'white',
                fontWeight: 600, cursor: 'pointer', opacity: isDisabled ? 0.5 : 1,
              }}
            >
              Bekreft overføring
            </button>
          </div>
        </div>
      </FocusTrap>
    </div>
  );
}
