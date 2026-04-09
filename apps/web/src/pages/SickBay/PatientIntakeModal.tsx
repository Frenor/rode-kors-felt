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

const inputStyle: React.CSSProperties = {
  width: '100%', height: 'var(--touch-min)', padding: '0 var(--space-3)',
  borderRadius: 'var(--radius-md)', border: '1px solid var(--color-input-border)',
  background: 'var(--color-input-bg)', color: 'var(--color-text)', fontSize: 'var(--text-base)',
  boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 'var(--text-sm)', fontWeight: 500, marginBottom: 'var(--space-1)',
};

const fieldStyle: React.CSSProperties = { marginBottom: 'var(--space-3)' };

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
          padding: 'var(--space-5)', maxWidth: 680, width: '100%',
          maxHeight: 'calc(100dvh - var(--space-8))', overflowY: 'auto',
        }}>
          <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, marginBottom: 'var(--space-4)' }}>
            Ny pasient
          </h2>

          {/* Fullt navn — full width */}
          <div style={fieldStyle}>
            <label htmlFor="fullName" style={labelStyle}>Fullt navn</label>
            <input id="fullName" type="text" value={form.fullName}
              onChange={(e) => onChange({ ...form, fullName: e.target.value })}
              placeholder="Fornavn Etternavn"
              style={inputStyle} />
          </div>

          {/* Kjønn + Aldersgruppe */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
            <div>
              <label htmlFor="gender" style={labelStyle}>Kjønn</label>
              <select id="gender" value={form.gender}
                onChange={(e) => onChange({ ...form, gender: e.target.value as IntakeFormShape['gender'] })}
                style={inputStyle}>
                <option value="">Ikke oppgitt</option>
                {GENDER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="ageGroup" style={labelStyle}>Aldersgruppe</label>
              <select id="ageGroup" value={form.ageGroup}
                onChange={(e) => onChange({ ...form, ageGroup: e.target.value })}
                style={inputStyle}>
                <option value="child">Barn</option>
                <option value="adolescent">Ungdom</option>
                <option value="adult">Voksen</option>
                <option value="elderly">Eldre</option>
              </select>
            </div>
          </div>

          {/* Fødselsdato + Plasseringstype + Plasseringsnummer */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
            <div>
              <label htmlFor="birthDate" style={labelStyle}>Fødselsdato</label>
              <input id="birthDate" type="date" value={form.birthDate}
                max={new Date().toISOString().slice(0, 10)}
                onChange={(e) => onChange({ ...form, birthDate: e.target.value })}
                style={inputStyle} />
              {form.birthDate && (
                <p style={{ marginTop: 'var(--space-1)', fontSize: 'var(--text-xs)', color: 'var(--color-text-subtle)' }}>
                  Alder: {previewAge != null ? `${previewAge} år` : 'Ukjent'}
                </p>
              )}
            </div>
            <div>
              <label htmlFor="placementType" style={labelStyle}>Plasseringstype</label>
              <select id="placementType" value={form.placementType}
                onChange={(e) => onChange({ ...form, placementType: e.target.value as IntakeFormShape['placementType'] })}
                style={inputStyle}>
                <option value="">Ikke satt</option>
                <option value="chair">Stol</option>
                <option value="bed">Seng</option>
              </select>
            </div>
            <div>
              <label htmlFor="placementNumber" style={labelStyle}>Nr.</label>
              <input id="placementNumber" type="text" inputMode="numeric" pattern="[0-9]*"
                value={form.placementNumber}
                onChange={(e) => onChange({ ...form, placementNumber: e.target.value.replace(/[^0-9]/g, '').slice(0, 4) })}
                placeholder="F.eks. 12"
                style={inputStyle} />
            </div>
          </div>

          {/* Problemstilling + Behandler */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
            <div>
              <label htmlFor="complaint" style={labelStyle}>Problemstilling</label>
              <input id="complaint" type="text" value={form.presentingComplaint}
                onChange={(e) => onChange({ ...form, presentingComplaint: e.target.value })}
                placeholder="Kort beskrivelse..."
                style={inputStyle} />
            </div>
            <div>
              <label htmlFor="clinician" style={labelStyle}>Behandler</label>
              <input id="clinician" type="text" value={form.assignedClinician}
                onChange={(e) => onChange({ ...form, assignedClinician: e.target.value })}
                placeholder="Navn..."
                style={inputStyle} />
            </div>
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
