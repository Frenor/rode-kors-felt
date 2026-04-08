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
      className="modal-backdrop"
    >
      <FocusTrap onEscape={onClose}>
        <div style={{
          background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-6)', maxWidth: 480, width: '100%',
          maxHeight: 'calc(100dvh - var(--space-8))', overflowY: 'auto',
        }}>
          <h2 className="text-lg fw-700 mb-4">
            Ny pasient
          </h2>

          <div className="mb-4">
            <label htmlFor="fullName" className="field-label">
              Fullt navn
            </label>
            <input id="fullName" type="text" value={form.fullName}
              onChange={(e) => onChange({ ...form, fullName: e.target.value })}
              placeholder="Fornavn Etternavn"
              className="form-input" />
          </div>

          <div className="mb-4">
            <label htmlFor="gender" className="field-label">
              Kjønn
            </label>
            <select id="gender" value={form.gender}
              onChange={(e) => onChange({ ...form, gender: e.target.value as IntakeFormShape['gender'] })}
              className="form-input">
              <option value="">Ikke oppgitt</option>
              {GENDER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>

          <div className="mb-4">
            <label htmlFor="birthDate" className="field-label">
              Fødselsdato
            </label>
            <input id="birthDate" type="date" value={form.birthDate}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => onChange({ ...form, birthDate: e.target.value })}
              className="form-input" />
            {form.birthDate && (
              <p className="mt-2 text-xs-subtle">
                Alder: {previewAge != null ? `${previewAge} år` : 'Ukjent'}
              </p>
            )}
          </div>

          <div className="mb-4">
            <label htmlFor="ageGroup" className="field-label">
              Aldersgruppe
            </label>
            <select id="ageGroup" value={form.ageGroup}
              onChange={(e) => onChange({ ...form, ageGroup: e.target.value })}
              className="form-input">
              <option value="child">Barn</option>
              <option value="adolescent">Ungdom</option>
              <option value="adult">Voksen</option>
              <option value="elderly">Eldre</option>
            </select>
          </div>

          <div className="mb-4">
            <label htmlFor="placementType" className="field-label">
              Plasseringstype
            </label>
            <select
              id="placementType"
              value={form.placementType}
              onChange={(e) => onChange({ ...form, placementType: e.target.value as IntakeFormShape['placementType'] })}
              className="form-input"
            >
              <option value="">Ikke satt</option>
              <option value="chair">Stol</option>
              <option value="bed">Seng</option>
            </select>
          </div>

          <div className="mb-4">
            <label htmlFor="placementNumber" className="field-label">
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
              className="form-input"
            />
          </div>

          <div className="mb-4">
            <label htmlFor="complaint" className="field-label">
              Problemstilling
            </label>
            <input id="complaint" type="text" value={form.presentingComplaint}
              onChange={(e) => onChange({ ...form, presentingComplaint: e.target.value })}
              placeholder="Kort beskrivelse..."
              className="form-input" />
          </div>

          <div className="mb-6">
            <label htmlFor="clinician" className="field-label">
              Behandler
            </label>
            <input id="clinician" type="text" value={form.assignedClinician}
              onChange={(e) => onChange({ ...form, assignedClinician: e.target.value })}
              placeholder="Navn..."
              className="form-input" />
          </div>

          <div className="flex gap-2">
            <button onClick={onClose} className="touch-target btn-ghost" style={{
              flex: 1, minHeight: 'var(--touch-min)',
            }}>
              Avbryt
            </button>
            <button onClick={onSubmit} className="touch-target btn-brand" style={{
              flex: 1, minHeight: 'var(--touch-min)',
            }}>
              Registrer
            </button>
          </div>
        </div>
      </FocusTrap>
    </div>
  );
}
