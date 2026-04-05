import { FocusTrap } from '../../components/FocusTrap';
import { calculateAgeYears, GENDER_OPTIONS } from '../../lib/constants';

export interface IntakeFormShape {
  fullName: string;
  gender: '' | 'male' | 'female' | 'other';
  birthDate: string;
  placementType: '' | 'chair' | 'bed';
  placementNumber: string;
  ageGroup: string;
  presentingComplaint: string;
  assignedClinician: string;
}

interface PatientIntakeModalProps {
  form: IntakeFormShape;
  onChange: (f: IntakeFormShape) => void;
  onSubmit: () => void;
  onClose: () => void;
}

export function PatientIntakeModal({ form, onChange, onSubmit, onClose }: PatientIntakeModalProps) {
  const previewAge = calculateAgeYears(form.birthDate);
  return (
    <div
      role="dialog"
      aria-label="Registrer ny pasient"
      aria-modal="true"
      style={{
        position: 'fixed', inset: 0, zIndex: 'var(--z-modal)',
        background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 'var(--space-4)',
      }}
    >
      <FocusTrap onEscape={onClose}>
        <div style={{
          background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-6)', maxWidth: 480, width: '100%',
        }}>
          <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, marginBottom: 'var(--space-4)' }}>
            Ny pasient
          </h2>

          <div style={{ marginBottom: 'var(--space-4)' }}>
            <label htmlFor="fullName" style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 500, marginBottom: 'var(--space-1)' }}>
              Fullt navn
            </label>
            <input id="fullName" type="text" value={form.fullName}
              onChange={(e) => onChange({ ...form, fullName: e.target.value })}
              placeholder="Fornavn Etternavn"
              style={{
                width: '100%', height: 'var(--touch-min)', padding: '0 var(--space-3)',
                borderRadius: 'var(--radius-md)', border: '1px solid var(--color-input-border)',
                background: 'var(--color-input-bg)', color: 'var(--color-text)', fontSize: 'var(--text-base)',
              }} />
          </div>

          <div style={{ marginBottom: 'var(--space-4)' }}>
            <label htmlFor="gender" style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 500, marginBottom: 'var(--space-1)' }}>
              Kjønn
            </label>
            <select id="gender" value={form.gender}
              onChange={(e) => onChange({ ...form, gender: e.target.value as IntakeFormShape['gender'] })}
              style={{
                width: '100%', height: 'var(--touch-min)', padding: '0 var(--space-3)',
                borderRadius: 'var(--radius-md)', border: '1px solid var(--color-input-border)',
                background: 'var(--color-input-bg)', color: 'var(--color-text)', fontSize: 'var(--text-base)',
              }}>
              <option value="">Ikke oppgitt</option>
              {GENDER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: 'var(--space-4)' }}>
            <label htmlFor="birthDate" style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 500, marginBottom: 'var(--space-1)' }}>
              Fødselsdato
            </label>
            <input id="birthDate" type="date" value={form.birthDate}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => onChange({ ...form, birthDate: e.target.value })}
              style={{
                width: '100%', height: 'var(--touch-min)', padding: '0 var(--space-3)',
                borderRadius: 'var(--radius-md)', border: '1px solid var(--color-input-border)',
                background: 'var(--color-input-bg)', color: 'var(--color-text)', fontSize: 'var(--text-base)',
              }} />
            {form.birthDate && (
              <p style={{ marginTop: 'var(--space-2)', fontSize: 'var(--text-xs)', color: 'var(--color-text-subtle)' }}>
                Alder: {previewAge != null ? `${previewAge} år` : 'Ukjent'}
              </p>
            )}
          </div>

          <div style={{ marginBottom: 'var(--space-4)' }}>
            <label htmlFor="ageGroup" style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 500, marginBottom: 'var(--space-1)' }}>
              Aldersgruppe
            </label>
            <select id="ageGroup" value={form.ageGroup}
              onChange={(e) => onChange({ ...form, ageGroup: e.target.value })}
              style={{
                width: '100%', height: 'var(--touch-min)', padding: '0 var(--space-3)',
                borderRadius: 'var(--radius-md)', border: '1px solid var(--color-input-border)',
                background: 'var(--color-input-bg)', color: 'var(--color-text)', fontSize: 'var(--text-base)',
              }}>
              <option value="child">Barn</option>
              <option value="adolescent">Ungdom</option>
              <option value="adult">Voksen</option>
              <option value="elderly">Eldre</option>
            </select>
          </div>

          <div style={{ marginBottom: 'var(--space-4)' }}>
            <label htmlFor="placementType" style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 500, marginBottom: 'var(--space-1)' }}>
              Plasseringstype
            </label>
            <select
              id="placementType"
              value={form.placementType}
              onChange={(e) => onChange({ ...form, placementType: e.target.value as IntakeFormShape['placementType'] })}
              style={{
                width: '100%', height: 'var(--touch-min)', padding: '0 var(--space-3)',
                borderRadius: 'var(--radius-md)', border: '1px solid var(--color-input-border)',
                background: 'var(--color-input-bg)', color: 'var(--color-text)', fontSize: 'var(--text-base)',
              }}
            >
              <option value="">Ikke satt</option>
              <option value="chair">Stol</option>
              <option value="bed">Seng</option>
            </select>
          </div>

          <div style={{ marginBottom: 'var(--space-4)' }}>
            <label htmlFor="placementNumber" style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 500, marginBottom: 'var(--space-1)' }}>
              Plasseringsnummer
            </label>
            <input
              id="placementNumber"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={form.placementNumber}
              onChange={(e) => onChange({ ...form, placementNumber: e.target.value.replace(/[^0-9]/g, '').slice(0, 4) })}
              placeholder="F.eks. 12"
              style={{
                width: '100%', height: 'var(--touch-min)', padding: '0 var(--space-3)',
                borderRadius: 'var(--radius-md)', border: '1px solid var(--color-input-border)',
                background: 'var(--color-input-bg)', color: 'var(--color-text)', fontSize: 'var(--text-base)',
              }}
            />
          </div>

          <div style={{ marginBottom: 'var(--space-4)' }}>
            <label htmlFor="complaint" style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 500, marginBottom: 'var(--space-1)' }}>
              Problemstilling
            </label>
            <input id="complaint" type="text" value={form.presentingComplaint}
              onChange={(e) => onChange({ ...form, presentingComplaint: e.target.value })}
              placeholder="Kort beskrivelse..."
              style={{
                width: '100%', height: 'var(--touch-min)', padding: '0 var(--space-3)',
                borderRadius: 'var(--radius-md)', border: '1px solid var(--color-input-border)',
                background: 'var(--color-input-bg)', color: 'var(--color-text)', fontSize: 'var(--text-base)',
              }} />
          </div>

          <div style={{ marginBottom: 'var(--space-6)' }}>
            <label htmlFor="clinician" style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 500, marginBottom: 'var(--space-1)' }}>
              Behandler
            </label>
            <input id="clinician" type="text" value={form.assignedClinician}
              onChange={(e) => onChange({ ...form, assignedClinician: e.target.value })}
              placeholder="Navn..."
              style={{
                width: '100%', height: 'var(--touch-min)', padding: '0 var(--space-3)',
                borderRadius: 'var(--radius-md)', border: '1px solid var(--color-input-border)',
                background: 'var(--color-input-bg)', color: 'var(--color-text)', fontSize: 'var(--text-base)',
              }} />
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <button onClick={onClose} className="touch-target" style={{
              flex: 1, minHeight: 'var(--touch-min)', borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text)',
              cursor: 'pointer',
            }}>
              Avbryt
            </button>
            <button onClick={onSubmit} className="touch-target" style={{
              flex: 1, minHeight: 'var(--touch-min)', borderRadius: 'var(--radius-md)',
              border: 'none', background: 'var(--color-brand)', color: 'white', fontWeight: 600,
              cursor: 'pointer',
            }}>
              Registrer
            </button>
          </div>
        </div>
      </FocusTrap>
    </div>
  );
}
