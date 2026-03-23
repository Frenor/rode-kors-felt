import { routeLabels } from '../../lib/constants';
import type { MedicationRecord } from '../../lib/types';

export interface MedFormShape {
  drug: string;
  dose: string;
  route: string;
  givenBy: string;
}

interface MedicationPanelProps {
  patientId: string;
  medications: MedicationRecord[];
  form: MedFormShape;
  onChange: (f: MedFormShape) => void;
  onSubmit: () => void;
}

const DRUG_OPTIONS = ['oxygen', 'aspirin', 'gtn', 'morfin', 'nalokson', 'glukose', 'adrenalin', 'annet'];

export function MedicationPanel({ patientId, medications, form, onChange, onSubmit }: MedicationPanelProps) {
  return (
    <div style={{
      marginTop: 'var(--space-3)', padding: 'var(--space-3)',
      background: 'var(--color-surface-sunken)', borderRadius: 'var(--radius-md)',
    }}>
      <h4 style={{ fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 'var(--space-2)' }}>Medikamentlogg</h4>

      {medications.length > 0 && (
        <div style={{ marginBottom: 'var(--space-3)' }}>
          {medications.map((med, i) => (
            <div key={i} style={{
              display: 'flex', gap: 'var(--space-2)', fontSize: 'var(--text-xs)',
              fontFamily: 'var(--font-mono)', color: 'var(--color-text-subtle)',
              padding: 'var(--space-1) 0', borderBottom: '1px solid var(--color-border)',
            }}>
              <span style={{ color: 'var(--color-text)', fontWeight: 600 }}>{med.drug}</span>
              {med.dose && <span>{med.dose}</span>}
              {med.route && <span>({routeLabels[med.route] ?? med.route})</span>}
              {med.givenBy && <span>— {med.givenBy}</span>}
              <span style={{ marginLeft: 'auto' }}>{new Date(med.givenAt).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
        <div>
          <label htmlFor={`med-drug-${patientId}`} style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-subtle)' }}>Medikament</label>
          <select id={`med-drug-${patientId}`} value={form.drug}
            onChange={(e) => onChange({ ...form, drug: e.target.value })}
            style={{ width: '100%', height: 36, borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-input-border)', background: 'var(--color-input-bg)', color: 'var(--color-text)', fontSize: 'var(--text-xs)' }}>
            {DRUG_OPTIONS.map((d) => (
              <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={`med-route-${patientId}`} style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-subtle)' }}>Administrasjonsvei</label>
          <select id={`med-route-${patientId}`} value={form.route}
            onChange={(e) => onChange({ ...form, route: e.target.value })}
            style={{ width: '100%', height: 36, borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-input-border)', background: 'var(--color-input-bg)', color: 'var(--color-text)', fontSize: 'var(--text-xs)' }}>
            {(Object.keys(routeLabels) as Array<keyof typeof routeLabels>).map((r) => (
              <option key={r} value={r}>{routeLabels[r]}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={`med-dose-${patientId}`} style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-subtle)' }}>Dose</label>
          <input id={`med-dose-${patientId}`} type="text" value={form.dose} placeholder="f.eks. 5 mg"
            onChange={(e) => onChange({ ...form, dose: e.target.value })}
            style={{ width: '100%', height: 36, padding: '0 var(--space-2)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-input-border)', background: 'var(--color-input-bg)', color: 'var(--color-text)', fontSize: 'var(--text-xs)' }} />
        </div>
        <div>
          <label htmlFor={`med-by-${patientId}`} style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-subtle)' }}>Gitt av</label>
          <input id={`med-by-${patientId}`} type="text" value={form.givenBy} placeholder="Navn"
            onChange={(e) => onChange({ ...form, givenBy: e.target.value })}
            style={{ width: '100%', height: 36, padding: '0 var(--space-2)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-input-border)', background: 'var(--color-input-bg)', color: 'var(--color-text)', fontSize: 'var(--text-xs)' }} />
        </div>
      </div>

      <button onClick={onSubmit} style={{
        width: '100%', minHeight: 36, borderRadius: 'var(--radius-sm)',
        border: 'none', background: 'var(--color-brand)', color: 'white',
        fontSize: 'var(--text-xs)', fontWeight: 600, cursor: 'pointer',
      }}>
        Registrer medikament
      </button>
    </div>
  );
}
