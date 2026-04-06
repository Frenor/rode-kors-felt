import { FocusTrap } from '../../components/FocusTrap';
import { formatPatientAge, GENDER_LABELS } from '../../lib/constants';
import type { SickBayPatient } from '../../lib/types';

export interface DischargeFormShape {
  departureMethod: 'gikk_hjem' | 'hentet_av' | 'taxi' | 'ambulanse' | 'annet' | '';
  departureByName: string;
  destination: 'hjem' | 'legevakt' | 'sykehus' | 'annet' | '';
  destinationName: string;
  notes: string;
}

export const EMPTY_DISCHARGE_FORM: DischargeFormShape = {
  departureMethod: '',
  departureByName: '',
  destination: '',
  destinationName: '',
  notes: '',
};

const DEPARTURE_METHOD_OPTIONS: { value: DischargeFormShape['departureMethod']; label: string }[] = [
  { value: '', label: 'Velg avgangsmetode…' },
  { value: 'gikk_hjem', label: 'Gikk hjem selv' },
  { value: 'hentet_av', label: 'Hentet av noen' },
  { value: 'taxi', label: 'Taxi' },
  { value: 'ambulanse', label: 'Ambulanse' },
  { value: 'annet', label: 'Annet' },
];

const DESTINATION_OPTIONS: { value: DischargeFormShape['destination']; label: string }[] = [
  { value: '', label: 'Velg destinasjon…' },
  { value: 'hjem', label: 'Hjem' },
  { value: 'legevakt', label: 'Legevakt' },
  { value: 'sykehus', label: 'Sykehus' },
  { value: 'annet', label: 'Annet' },
];

export const DEPARTURE_METHOD_LABELS: Record<NonNullable<DischargeFormShape['departureMethod']>, string> = {
  '': '',
  gikk_hjem: 'Gikk hjem selv',
  hentet_av: 'Hentet av noen',
  taxi: 'Taxi',
  ambulanse: 'Ambulanse',
  annet: 'Annet',
};

export const DESTINATION_LABELS: Record<NonNullable<DischargeFormShape['destination']>, string> = {
  '': '',
  hjem: 'Hjem',
  legevakt: 'Legevakt',
  sykehus: 'Sykehus',
  annet: 'Annet',
};

/** Build a plain-text note summarising how the patient left. */
export function buildDischargeNote(form: DischargeFormShape): string {
  const lines: string[] = [
    `Avgangsmetode: ${DEPARTURE_METHOD_LABELS[form.departureMethod]}`,
  ];
  if (form.departureMethod === 'hentet_av' && form.departureByName.trim()) {
    lines.push(`Hentet av: ${form.departureByName.trim()}`);
  }
  lines.push(`Destinasjon: ${DESTINATION_LABELS[form.destination]}`);
  if ((form.destination === 'sykehus' || form.destination === 'annet') && form.destinationName.trim()) {
    lines.push(`Sted: ${form.destinationName.trim()}`);
  }
  if (form.notes.trim()) {
    lines.push('', `Merknad:\n${form.notes.trim()}`);
  }
  return lines.join('\n');
}

interface PatientDischargeModalProps {
  patient: SickBayPatient | null;
  targetStatus: 'discharged' | 'transferred';
  form: DischargeFormShape;
  onChange: (f: DischargeFormShape) => void;
  onSubmit: () => void;
  onClose: () => void;
  submitting?: boolean;
}

const INPUT_STYLE = {
  width: '100%', height: 40, padding: '0 var(--space-2)',
  borderRadius: 'var(--radius-md)', border: '1px solid var(--color-input-border)',
  background: 'var(--color-input-bg)', color: 'var(--color-text)',
  fontSize: 'var(--text-sm)',
};

export function PatientDischargeModal({
  patient,
  targetStatus,
  form,
  onChange,
  onSubmit,
  onClose,
  submitting,
}: PatientDischargeModalProps) {
  const isTransfer = targetStatus === 'transferred';
  const title = isTransfer ? 'Overfør pasient' : 'Skriv ut pasient';
  const submitLabel = isTransfer ? 'Bekreft overføring' : 'Bekreft utskrivelse';
  const isDisabled = !form.departureMethod || !form.destination || submitting;

  const patientName = patient?.fullName ?? patient?.presentingComplaint ?? 'Ukjent pasient';
  const patientAgeLabel = formatPatientAge({
    birthDate: patient?.birthDate ?? null,
    ageGroup: patient?.ageGroup ?? null,
    ageYears: patient?.ageYears ?? null,
  });
  const patientGenderLabel = patient?.gender ? GENDER_LABELS[patient.gender] : null;
  const patientLine = [patientName, patientAgeLabel, patientGenderLabel].filter(Boolean).join(' · ');

  const now = new Date().toLocaleString('nb-NO', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

  return (
    <div
      role="dialog"
      aria-label={title}
      aria-modal="true"
      style={{
        position: 'fixed', inset: 0, zIndex: 'var(--z-modal)',
        background: 'rgba(0,0,0,0.6)', display: 'flex',
        alignItems: 'center', justifyContent: 'center', padding: 'var(--space-4)',
      }}
    >
      <FocusTrap onEscape={onClose}>
        <div style={{
          background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-6)', maxWidth: 480, width: '100%',
          maxHeight: '92vh', overflowY: 'auto',
        }}>
          <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, marginBottom: 'var(--space-1)' }}>
            {title}
          </h2>
          <p style={{
            fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)',
            color: 'var(--color-text-subtle)', marginBottom: 'var(--space-4)',
          }}>
            {patientLine}
          </p>

          {/* Departure method */}
          <div style={{ marginBottom: 'var(--space-3)' }}>
            <label
              htmlFor="discharge-departure"
              style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 'var(--space-1)' }}
            >
              Hvordan forlot pasienten?
            </label>
            <select
              id="discharge-departure"
              value={form.departureMethod}
              onChange={(e) => onChange({ ...form, departureMethod: e.target.value as DischargeFormShape['departureMethod'] })}
              style={{ ...INPUT_STYLE, cursor: 'pointer' }}
            >
              {DEPARTURE_METHOD_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* Conditional: name of person picking up */}
          {form.departureMethod === 'hentet_av' && (
            <div style={{ marginBottom: 'var(--space-3)' }}>
              <label
                htmlFor="discharge-departure-name"
                style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 'var(--space-1)' }}
              >
                Navn på personen som hentet
              </label>
              <input
                id="discharge-departure-name"
                type="text"
                value={form.departureByName}
                onChange={(e) => onChange({ ...form, departureByName: e.target.value })}
                placeholder="Valgfritt"
                style={INPUT_STYLE}
              />
            </div>
          )}

          {/* Destination */}
          <div style={{ marginBottom: 'var(--space-3)' }}>
            <label
              htmlFor="discharge-destination"
              style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 'var(--space-1)' }}
            >
              Hvor dro pasienten?
            </label>
            <select
              id="discharge-destination"
              value={form.destination}
              onChange={(e) => onChange({ ...form, destination: e.target.value as DischargeFormShape['destination'] })}
              style={{ ...INPUT_STYLE, cursor: 'pointer' }}
            >
              {DESTINATION_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* Conditional: hospital/other name */}
          {(form.destination === 'sykehus' || form.destination === 'annet') && (
            <div style={{ marginBottom: 'var(--space-3)' }}>
              <label
                htmlFor="discharge-destination-name"
                style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 'var(--space-1)' }}
              >
                {form.destination === 'sykehus' ? 'Sykehusnavn (valgfritt)' : 'Spesifiser destinasjon'}
              </label>
              <input
                id="discharge-destination-name"
                type="text"
                value={form.destinationName}
                onChange={(e) => onChange({ ...form, destinationName: e.target.value })}
                placeholder={form.destination === 'sykehus' ? 'f.eks. Oslo universitetssykehus' : ''}
                style={INPUT_STYLE}
              />
            </div>
          )}

          {/* Transfer notes */}
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <label
              htmlFor="discharge-notes"
              style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 'var(--space-1)' }}
            >
              {isTransfer ? 'Overlevering — hva skjedde, hva ble gjort, hva må følges opp' : 'Merknader'}
              <span style={{ fontWeight: 400, color: 'var(--color-text-subtle)', marginLeft: 4 }}>(valgfritt)</span>
            </label>
            <textarea
              id="discharge-notes"
              value={form.notes}
              onChange={(e) => onChange({ ...form, notes: e.target.value })}
              rows={isTransfer ? 5 : 3}
              placeholder={isTransfer
                ? 'Nåværende tilstand, behandling gitt, hva AMK/ambulanse bør vite...'
                : 'Eventuelle merknader ved utskrivelse...'}
              style={{
                width: '100%', padding: 'var(--space-2)',
                borderRadius: 'var(--radius-md)', border: '1px solid var(--color-input-border)',
                background: 'var(--color-input-bg)', color: 'var(--color-text)',
                fontSize: 'var(--text-sm)', resize: 'vertical', fontFamily: 'inherit',
              }}
            />
          </div>

          {/* Auto timestamp */}
          <p style={{
            fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)',
            color: 'var(--color-text-subtle)', marginBottom: 'var(--space-4)',
          }}>
            Tidspunkt registreres automatisk: {now}
          </p>

          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <button
              type="button"
              onClick={onClose}
              className="touch-target"
              style={{
                flex: 1, minHeight: 'var(--touch-min)', borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)', background: 'transparent',
                color: 'var(--color-text)', cursor: 'pointer',
              }}
            >
              Avbryt
            </button>
            <button
              type="button"
              onClick={onSubmit}
              disabled={isDisabled}
              className="touch-target"
              style={{
                flex: 1, minHeight: 'var(--touch-min)', borderRadius: 'var(--radius-md)',
                border: 'none',
                background: isTransfer ? 'var(--color-status-critical)' : 'var(--color-brand)',
                color: 'white', fontWeight: 600,
                cursor: isDisabled ? 'default' : 'pointer',
                opacity: isDisabled ? 0.5 : 1,
              }}
            >
              {submitting ? 'Lagrer...' : submitLabel}
            </button>
          </div>
        </div>
      </FocusTrap>
    </div>
  );
}
