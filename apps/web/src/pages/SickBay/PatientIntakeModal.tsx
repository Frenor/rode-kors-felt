import { FocusTrap } from '../../components/FocusTrap';

export interface IntakeFormShape {
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
