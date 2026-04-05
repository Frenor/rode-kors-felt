import { useState } from 'react';
import {
  calculateNEWS2,
  calculateNEWS2Trend,
  news2BadgeLabel,
  news2MonitoringLabel,
  type News2Result,
} from '@rkf/shared-types';
import {
  formatPatientAge,
  GENDER_LABELS,
  news2Colors,
  statusColors,
  statusLabels,
} from '../../lib/constants';
import type { SickBayPatient, MedicationRecord } from '../../lib/types';
import { PatientVitalsDisplay } from './PatientVitalsDisplay';
import { PatientActionButtons } from './PatientActionButtons';
import { VitalsEntryForm, type VitalsFormShape } from './VitalsEntryForm';
import { MedicationPanel, type MedFormShape } from './MedicationPanel';
import { NotePanel, type NoteFormShape } from './NotePanel';
import { PatientHistoryTimeline } from './PatientHistoryTimeline';

const EMPTY_VITALS_FORM: VitalsFormShape = {
  pulse: '', spo2: '', rr: '', pain: '', bp: '', temp: '', acvpu: '',
};

const EMPTY_MED_FORM: MedFormShape = {
  drug: 'oxygen', dose: '', route: 'inhaled', givenBy: '',
};

const EMPTY_NOTE_FORM: NoteFormShape = {
  text: '', author: '',
};

interface PatientCardProps {
  patient: SickBayPatient;
  medications: MedicationRecord[];
  onStatusChange: (status: string) => void;
  onSubmitVitals: (form: VitalsFormShape) => void;
  onSubmitNote: (text: string, author: string) => void;
  onSubmitMedication: (form: MedFormShape) => void;
  onLoadMedications: () => void;
  onOpenAmk: () => void;
}

export function PatientCard({
  patient,
  medications,
  onStatusChange,
  onSubmitVitals,
  onSubmitNote,
  onSubmitMedication,
  onLoadMedications,
  onOpenAmk,
}: PatientCardProps) {
  const [showVitals, setShowVitals] = useState(false);
  const [showMeds, setShowMeds] = useState(false);
  const [showNote, setShowNote] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [vitalsForm, setVitalsForm] = useState<VitalsFormShape>(EMPTY_VITALS_FORM);
  const [medForm, setMedForm] = useState<MedFormShape>(EMPTY_MED_FORM);
  const [noteForm, setNoteForm] = useState<NoteFormShape>(EMPTY_NOTE_FORM);

  const news2 = patient.latestVitals ? calculateNEWS2(patient.latestVitals) : null;
  const n2colors = news2 ? news2Colors[news2.alertLevel] : null;
  const sc = statusColors[patient.status] ?? { color: 'var(--color-text-subtle)', bg: 'var(--color-surface-sunken)' };

  const patientName = patient.fullName ?? patient.presentingComplaint ?? 'Ukjent pasient';
  const patientAgeLabel = formatPatientAge({
    birthDate: patient.birthDate ?? null,
    ageGroup: patient.ageGroup ?? null,
    ageYears: patient.ageYears ?? null,
  });
  const patientGenderLabel = patient.gender ? GENDER_LABELS[patient.gender] : null;
  const patientDemographics = [patientAgeLabel, patientGenderLabel].filter(Boolean).join(' · ');
  const complaintText = patient.presentingComplaint ?? 'Problemstilling ikke registrert';
  const news2MissingLabels: string[] = news2
    ? ([
        ['respiratoryRate', 'RF'],
        ['spo2', 'SpO₂'],
        ['systolicBP', 'BT'],
        ['pulse', 'Puls'],
        ['consciousness', 'Bevissthet'],
        ['temperature', 'Temp'],
      ] as [keyof News2Result['scores'], string][])
        .filter(([key]) => news2.scores[key] === null)
        .map(([, label]) => label)
    : [];

  const trend = (patient.vitalsHistory?.length ?? 0) >= 2
    ? calculateNEWS2Trend(patient.vitalsHistory)
    : null;
  const trendArrow = trend?.direction === 'rising' ? '↑'
    : trend?.direction === 'falling' ? '↓'
    : trend ? '→' : null;
  const trendColor = trend?.direction === 'rising' ? 'var(--color-status-critical)'
    : trend?.direction === 'falling' ? 'var(--color-status-ok)'
    : 'var(--color-text-subtle)';

  const handleToggleVitals = () => {
    setShowVitals((prev) => !prev);
  };

  const handleToggleMedication = () => {
    if (!showMeds) {
      onLoadMedications();
    }
    setShowMeds((prev) => !prev);
  };

  const handleToggleNote = () => {
    if (showNote) {
      setNoteForm(EMPTY_NOTE_FORM);
    }
    setShowNote((prev) => !prev);
  };

  const handleToggleHistory = () => {
    if (!showHistory) {
      onLoadMedications();
    }
    setShowHistory((prev) => !prev);
  };

  const handleSubmitVitals = () => {
    onSubmitVitals(vitalsForm);
    setVitalsForm(EMPTY_VITALS_FORM);
    setShowVitals(false);
  };

  const handleSubmitNote = () => {
    onSubmitNote(noteForm.text.trim(), noteForm.author.trim() || 'Ukjent');
    setNoteForm(EMPTY_NOTE_FORM);
    setShowNote(false);
  };

  const handleSubmitMedication = () => {
    onSubmitMedication(medForm);
    setMedForm(EMPTY_MED_FORM);
    setShowMeds(false);
  };

  return (
    <article
      aria-label={`Pasient ${patientName}${patientDemographics ? ` · ${patientDemographics}` : ''}`}
      style={{
        padding: 'var(--space-4)', borderRadius: 'var(--radius-md)',
        border: '1px solid var(--color-border)', background: 'var(--color-surface)',
      }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
          <span style={{ fontWeight: 600 }}>{patientName}</span>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-subtle)' }}>{complaintText}</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--color-text-subtle)' }}>
            {patientDemographics}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
          {news2 && n2colors && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <span
                    aria-label={`${news2BadgeLabel(news2)}${news2MissingLabels.length > 0 ? ' (ufullstendig score)' : ''}: ${news2MonitoringLabel(news2)}`}
                    style={{
                      fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', fontWeight: 700,
                      padding: '2px 8px', borderRadius: 'var(--radius-full)',
                      background: n2colors.bg, color: n2colors.color,
                    }}
                  >
                    {news2BadgeLabel(news2)}{news2MissingLabels.length > 0 ? '*' : ''}
                  </span>
                  {trendArrow && (
                    <span
                      aria-label={`Trend: ${trend?.direction}`}
                      style={{ fontWeight: 700, fontSize: 'var(--text-sm)', color: trendColor }}
                    >
                      {trendArrow}
                    </span>
                  )}
                </span>
                {news2MissingLabels.length > 0 && (
                  <span style={{
                    fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)',
                    color: 'var(--color-text-subtle)', fontStyle: 'italic',
                  }}>
                    * {news2MissingLabels.join(', ')} ikke målt
                  </span>
                )}
                <span style={{
                  fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)',
                  color: n2colors.color,
                }}>
                  {news2MonitoringLabel(news2)}
                </span>
              </span>
            </span>
          )}
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)',
            padding: '2px 8px', borderRadius: 'var(--radius-full)',
            background: sc.bg, color: sc.color,
          }}>
            {statusLabels[patient.status] || patient.status}
          </span>
        </div>
      </div>

      {/* Latest vitals display */}
      {patient.latestVitals && (
        <PatientVitalsDisplay vitals={patient.latestVitals} />
      )}

      {/* Action buttons + status transitions */}
      <PatientActionButtons
        patient={patient}
        showVitals={showVitals}
        showMeds={showMeds}
        showNote={showNote}
        showHistory={showHistory}
        onToggleVitals={handleToggleVitals}
        onToggleMedication={handleToggleMedication}
        onToggleNote={handleToggleNote}
        onToggleHistory={handleToggleHistory}
        onOpenAmk={onOpenAmk}
        onStatusChange={onStatusChange}
      />

      {/* Medication panel */}
      {showMeds && (
        <MedicationPanel
          patientId={patient.id}
          medications={medications}
          form={medForm}
          onChange={setMedForm}
          onSubmit={handleSubmitMedication}
        />
      )}

      {/* Note panel */}
      {showNote && (
        <NotePanel
          patientId={patient.id}
          form={noteForm}
          onChange={setNoteForm}
          onSubmit={handleSubmitNote}
        />
      )}

      {/* Vitals entry form */}
      {showVitals && (
        <VitalsEntryForm
          patientId={patient.id}
          form={vitalsForm}
          onChange={setVitalsForm}
          onSubmit={handleSubmitVitals}
        />
      )}

      {/* Patient history timeline */}
      {showHistory && (
        <PatientHistoryTimeline patient={patient} medications={medications} />
      )}
    </article>
  );
}
