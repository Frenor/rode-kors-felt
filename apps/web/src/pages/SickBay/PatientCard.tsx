import { useEffect, useRef, useState } from 'react';
import {
  calculateNEWS2,
  calculateNEWS2Trend,
  news2BadgeLabel,
  news2MonitoringLabel,
  type News2Result,
} from '@rkf/shared-types';
import {
  calculateAgeYears,
  formatPatientAge,
  formatSickbayPlacement,
  GENDER_LABELS,
  GENDER_OPTIONS,
  news2Colors,
  STATUS_TRANSITIONS,
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

export interface DemographicsFormShape {
  fullName: string;
  gender: '' | 'male' | 'female' | 'other';
  birthDate: string;
  ageGroup: string;
}

interface PatientCardProps {
  patient: SickBayPatient;
  medications: MedicationRecord[];
  onStatusChange: (status: string) => void;
  onSubmitVitals: (form: VitalsFormShape) => void;
  onSubmitNote: (text: string, author: string) => void;
  onSubmitMedication: (form: MedFormShape) => void;
  onLoadMedications: () => void;
  onOpenAmk: () => void;
  onUpdatePlacement: (placementType: 'chair' | 'bed' | '', placementNumber: string) => void;
  onUpdateDemographics: (form: DemographicsFormShape) => void;
  onUpdateComplaint: (complaint: string) => void;
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
  onUpdatePlacement,
  onUpdateDemographics,
  onUpdateComplaint,
}: PatientCardProps) {
  const [showVitals, setShowVitals] = useState(false);
  const [showMeds, setShowMeds] = useState(false);
  const [showNote, setShowNote] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showPlacementEditor, setShowPlacementEditor] = useState(false);
  const [showDemographicsEditor, setShowDemographicsEditor] = useState(false);
  const [showComplaintEditor, setShowComplaintEditor] = useState(false);
  const [complaintDraft, setComplaintDraft] = useState(patient.presentingComplaint ?? '');
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const statusMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showStatusMenu) return;
    const handler = (e: MouseEvent) => {
      if (statusMenuRef.current && !statusMenuRef.current.contains(e.target as Node)) {
        setShowStatusMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showStatusMenu]);
  const [vitalsForm, setVitalsForm] = useState<VitalsFormShape>(EMPTY_VITALS_FORM);
  const [medForm, setMedForm] = useState<MedFormShape>(EMPTY_MED_FORM);
  const [noteForm, setNoteForm] = useState<NoteFormShape>(EMPTY_NOTE_FORM);
  const [placementType, setPlacementType] = useState<'chair' | 'bed' | ''>(patient.placementType ?? '');
  const [placementNumber, setPlacementNumber] = useState(patient.placementNumber ?? '');
  const [demoForm, setDemoForm] = useState<DemographicsFormShape>({
    fullName: patient.fullName ?? '',
    gender: (patient.gender as DemographicsFormShape['gender']) ?? '',
    birthDate: patient.birthDate ?? '',
    ageGroup: patient.ageGroup ?? 'adult',
  });

  const currentStatus = patient.status as keyof typeof STATUS_TRANSITIONS;
  const nextStatuses = STATUS_TRANSITIONS[currentStatus] ?? [];
  const actionCopy: Record<string, { label: string; icon: string }> = {
    'incoming:in_treatment': { label: 'Start behandling', icon: '▶' },
    'incoming:observation': { label: 'Observasjon', icon: '⊕' },
    'in_treatment:observation': { label: 'Observasjon', icon: '→' },
    'observation:in_treatment': { label: 'Start behandling', icon: '▶' },
    'in_treatment:discharged': { label: 'Skriv ut', icon: '✓' },
    'observation:discharged': { label: 'Skriv ut', icon: '✓' },
    'in_treatment:transferred': { label: 'Overfør', icon: '⇢' },
    'observation:transferred': { label: 'Overfør', icon: '⇢' },
    'discharged:observation': { label: 'Observasjon', icon: '↺' },
    'transferred:observation': { label: 'Observasjon', icon: '↺' },
    'discharged:in_treatment': { label: 'Start behandling', icon: '↺' },
    'transferred:in_treatment': { label: 'Start behandling', icon: '↺' },
    'in_treatment:incoming': { label: 'Innkommende', icon: '↩' },
    'observation:incoming': { label: 'Innkommende', icon: '↩' },
  };

  const news2 = patient.latestVitals ? calculateNEWS2(patient.latestVitals) : null;
  const n2colors = news2 ? news2Colors[news2.alertLevel] : null;

  const patientName = patient.fullName ?? patient.presentingComplaint ?? 'Ukjent pasient';
  const patientAgeLabel = formatPatientAge({
    birthDate: patient.birthDate ?? null,
    ageGroup: patient.ageGroup ?? null,
    ageYears: patient.ageYears ?? null,
  });
  const patientGenderLabel = patient.gender ? GENDER_LABELS[patient.gender] : null;
  const patientDemographics = [patientAgeLabel, patientGenderLabel].filter(Boolean).join(' · ');
  const complaintText = patient.presentingComplaint ?? 'Problemstilling ikke registrert';
  const placementLabel = formatSickbayPlacement(patient.placementType ?? null, patient.placementNumber ?? null);
  const sc = statusColors[patient.status] ?? { color: 'var(--color-text-subtle)', bg: 'transparent' };
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
  // Arrow represents patient health direction, not the raw score direction.
  // Rising NEWS2 = worsening condition → show ↓; falling NEWS2 = improving → show ↑.
  const trendArrow = trend?.direction === 'rising' ? '↓'
    : trend?.direction === 'falling' ? '↑'
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

  const handleSubmitPlacement = () => {
    onUpdatePlacement(placementType, placementNumber);
    setShowPlacementEditor(false);
  };

  const handleSubmitDemographics = () => {
    onUpdateDemographics(demoForm);
    setShowDemographicsEditor(false);
  };

  const handleTogglePlacementEditor = () => {
    if (!showPlacementEditor) {
      setPlacementType(patient.placementType ?? '');
      setPlacementNumber(patient.placementNumber ?? '');
    }
    setShowPlacementEditor((prev) => !prev);
  };

  const handleToggleDemographicsEditor = () => {
    if (!showDemographicsEditor) {
      setDemoForm({
        fullName: patient.fullName ?? '',
        gender: (patient.gender as DemographicsFormShape['gender']) ?? '',
        birthDate: patient.birthDate ?? '',
        ageGroup: patient.ageGroup ?? 'adult',
      });
    }
    setShowDemographicsEditor((prev) => !prev);
  };

  const handleToggleComplaintEditor = () => {
    if (!showComplaintEditor) {
      setComplaintDraft(patient.presentingComplaint ?? '');
    }
    setShowComplaintEditor((prev) => !prev);
  };

  // Re-initialise placement state only when the patient identity changes.
  // NOT on individual field changes — that would clobber what the user is
  // currently typing if a concurrent prop update (WS / fetchPatients) arrives.
  useEffect(() => {
    setPlacementType(patient.placementType ?? '');
    setPlacementNumber(patient.placementNumber ?? '');
  }, [patient.id]); // intentional: only reset on patient identity change

  useEffect(() => {
    // Same rationale as placement useEffect above — patient.id only.
    setDemoForm({
      fullName: patient.fullName ?? '',
      gender: (patient.gender as DemographicsFormShape['gender']) ?? '',
      birthDate: patient.birthDate ?? '',
      ageGroup: patient.ageGroup ?? 'adult',
    });
  }, [patient.id]); // intentional: only reset on patient identity change

  useEffect(() => {
    // Same rationale as placement useEffect above — patient.id only.
    setComplaintDraft(patient.presentingComplaint ?? '');
  }, [patient.id]); // intentional: only reset on patient identity change

  const handleSubmitComplaint = () => {
    onUpdateComplaint(complaintDraft.trim());
    setShowComplaintEditor(false);
  };

  return (
    <article
      aria-label={`Pasient ${patientName}${patientDemographics ? ` · ${patientDemographics}` : ''}`}
      style={{
        padding: 'var(--space-3)', borderRadius: 'var(--radius-md)',
        border: '1px solid var(--color-border)', background: 'var(--color-surface)',
        display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', height: '100%',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'nowrap', gap: 'var(--space-2)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
          <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{patientName}</span>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-subtle)' }}>{complaintText}</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--color-text-subtle)' }}>
            {`${placementLabel || 'Ikke satt'}${patientDemographics ? ` · ${patientDemographics}` : ''}`}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-1)', alignItems: 'center', flexShrink: 0 }}>
          {news2 && n2colors && (
            <span
              title={`${news2MonitoringLabel(news2)}${news2MissingLabels.length > 0 ? ` · Mangler: ${news2MissingLabels.join(', ')}` : ''}`}
              aria-label={`NEWS2 ${news2BadgeLabel(news2)}${news2MissingLabels.length > 0 ? ' (ufullstendig score)' : ''}: ${news2MonitoringLabel(news2)}`}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 2,
                fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', fontWeight: 700,
                padding: '2px 6px', borderRadius: 'var(--radius-full)',
                background: n2colors.bg, color: n2colors.color,
              }}
            >
              {news2BadgeLabel(news2)}{news2MissingLabels.length > 0 ? '*' : ''}
              {trendArrow && (
                <span aria-hidden="true" style={{ fontWeight: 700, color: trendColor }}>{trendArrow}</span>
              )}
            </span>
          )}
          <div ref={statusMenuRef} style={{ position: 'relative' }} data-testid={`patient-status-${patient.id}`}>
            <button
              type="button"
              data-testid={`patient-status-badge-${patient.id}`}
              aria-label={`Status: ${statusLabels[patient.status] ?? patient.status}. Trykk for å endre`}
              aria-expanded={showStatusMenu}
              aria-haspopup="listbox"
              onClick={() => setShowStatusMenu((prev) => !prev)}
              style={{
                fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)',
                padding: '2px 8px', borderRadius: 'var(--radius-full)',
                background: sc.bg, color: sc.color,
                border: 'none', cursor: nextStatuses.length > 0 ? 'pointer' : 'default',
                display: 'inline-flex', alignItems: 'center', gap: 4,
              }}
            >
              {statusLabels[patient.status] || patient.status}
              {nextStatuses.length > 0 && (
                <span aria-hidden="true" style={{ fontSize: '0.6em', opacity: 0.7 }}>▾</span>
              )}
            </button>

            {nextStatuses.length > 0 && (
              <div
                role="listbox"
                aria-label="Mulige statusendringer"
                data-testid={`patient-status-menu-${patient.id}`}
                hidden={!showStatusMenu}
                style={{
                  position: 'absolute', top: 'calc(100% + 4px)', right: 0, zIndex: 50,
                  background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)', boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  minWidth: 180, overflow: 'hidden',
                }}
              >
                {nextStatuses.map((nextStatus) => {
                  const nsc = statusColors[nextStatus] ?? { color: 'var(--color-text-subtle)', bg: 'transparent' };
                  const isTransfer = nextStatus === 'transferred';
                  const copy = actionCopy[`${currentStatus}:${nextStatus}`];
                  return (
                    <button
                      key={nextStatus}
                      role="option"
                      data-testid={`status-btn-${nextStatus}`}
                      aria-selected={false}
                      aria-label={copy?.label ?? statusLabels[nextStatus]}
                      onClick={() => { onStatusChange(nextStatus); setShowStatusMenu(false); }}
                      style={{
                        display: 'flex', width: '100%', alignItems: 'center', gap: 8,
                        padding: 'var(--space-2) var(--space-3)',
                        minHeight: 'var(--touch-min)',
                        border: 'none', borderBottom: '1px solid var(--color-border)',
                        background: 'transparent', cursor: 'pointer', textAlign: 'left',
                        fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)',
                        color: nsc.color,
                      }}
                    >
                      <span
                        aria-hidden="true"
                        style={{
                          display: 'inline-block', width: 8, height: 8,
                          borderRadius: '50%', flexShrink: 0,
                          background: isTransfer ? 'transparent' : nsc.color,
                          outline: isTransfer ? `2px dashed ${nsc.color}` : 'none',
                          outlineOffset: 2,
                        }}
                      />
                      <span style={{ fontWeight: 600, fontSize: '0.9em' }}>{copy?.icon}</span>
                      <span>{copy?.label ?? statusLabels[nextStatus]}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {patient.latestVitals && (
        <PatientVitalsDisplay vitals={patient.latestVitals} />
      )}

      <PatientActionButtons
        showVitals={showVitals}
        showMeds={showMeds}
        showNote={showNote}
        showHistory={showHistory}
        onToggleVitals={handleToggleVitals}
        onToggleMedication={handleToggleMedication}
        onToggleNote={handleToggleNote}
        onToggleHistory={handleToggleHistory}
        onOpenAmk={onOpenAmk}
      />

      {/* Compact editor bar — 3 pills in one row */}
      <div style={{ display: 'flex', gap: 'var(--space-1)', flexWrap: 'wrap' }}>
        <button
          type="button"
          aria-label={showPlacementEditor ? 'Lukk plassering' : 'Rediger plassering'}
          aria-expanded={showPlacementEditor}
          onClick={handleTogglePlacementEditor}
          style={{
            minHeight: 28,
            padding: '0 var(--space-2)',
            borderRadius: 'var(--radius-full)',
            border: `1px solid ${showPlacementEditor ? 'var(--color-brand)' : 'var(--color-border)'}`,
            background: showPlacementEditor ? 'var(--color-brand-dim)' : 'transparent',
            fontSize: 'var(--text-xs)',
            fontFamily: 'var(--font-mono)',
            color: showPlacementEditor ? 'var(--color-brand)' : 'var(--color-text-subtle)',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          {showPlacementEditor ? '✕ Plassering' : '✎ Plassering'}
        </button>

        <button
          type="button"
          aria-label={showDemographicsEditor ? 'Lukk pasientinfo' : 'Rediger pasientinfo'}
          aria-expanded={showDemographicsEditor}
          data-testid={`demographics-editor-toggle-${patient.id}`}
          onClick={handleToggleDemographicsEditor}
          style={{
            minHeight: 28,
            padding: '0 var(--space-2)',
            borderRadius: 'var(--radius-full)',
            border: `1px solid ${showDemographicsEditor ? 'var(--color-brand)' : 'var(--color-border)'}`,
            background: showDemographicsEditor ? 'var(--color-brand-dim)' : 'transparent',
            fontSize: 'var(--text-xs)',
            fontFamily: 'var(--font-mono)',
            color: showDemographicsEditor ? 'var(--color-brand)' : 'var(--color-text-subtle)',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          {showDemographicsEditor ? '✕ Pasientinfo' : '✎ Pasientinfo'}
        </button>

        <button
          type="button"
          aria-label={showComplaintEditor ? 'Lukk problemstilling' : 'Rediger problemstilling'}
          aria-expanded={showComplaintEditor}
          data-testid={`complaint-editor-toggle-${patient.id}`}
          onClick={handleToggleComplaintEditor}
          style={{
            minHeight: 28,
            padding: '0 var(--space-2)',
            borderRadius: 'var(--radius-full)',
            border: `1px solid ${showComplaintEditor ? 'var(--color-brand)' : 'var(--color-border)'}`,
            background: showComplaintEditor ? 'var(--color-brand-dim)' : 'transparent',
            fontSize: 'var(--text-xs)',
            fontFamily: 'var(--font-mono)',
            color: showComplaintEditor ? 'var(--color-brand)' : 'var(--color-text-subtle)',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          {showComplaintEditor ? '✕ Beskrivelse' : '✎ Beskrivelse'}
        </button>
      </div>

      {showPlacementEditor && (
          <div
            data-testid={`placement-editor-${patient.id}`}
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr auto',
              gap: 'var(--space-2)',
              alignItems: 'end',
              background: 'var(--color-surface-sunken)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-3)',
            }}
          >
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 'var(--text-xs)' }}>
              Type
              <select
                value={placementType}
                onChange={(e) => setPlacementType(e.target.value as 'chair' | 'bed' | '')}
                style={{
                  height: 'var(--touch-min)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-input-border)',
                  background: 'var(--color-input-bg)',
                  color: 'var(--color-text)',
                  padding: '0 var(--space-2)',
                }}
              >
                <option value="">Ikke satt</option>
                <option value="chair">Stol</option>
                <option value="bed">Seng</option>
              </select>
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 'var(--text-xs)' }}>
              Nummer
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={placementNumber}
                onChange={(e) => setPlacementNumber(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
                placeholder="F.eks. 12"
                style={{
                  height: 'var(--touch-min)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-input-border)',
                  background: 'var(--color-input-bg)',
                  color: 'var(--color-text)',
                  padding: '0 var(--space-2)',
                }}
              />
            </label>

            <button
              type="button"
              className="touch-target"
              onClick={handleSubmitPlacement}
              style={{
                minHeight: 'var(--touch-min)',
                borderRadius: 'var(--radius-md)',
                border: 'none',
                background: 'var(--color-brand)',
                color: '#fff',
                fontWeight: 700,
                padding: '0 var(--space-3)',
                cursor: 'pointer',
              }}
            >
              Lagre
            </button>
          </div>
        )}

      {showDemographicsEditor && (
        <div
          data-testid={`demographics-editor-${patient.id}`}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-3)',
            background: 'var(--color-surface-sunken)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-3)',
          }}
        >
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 'var(--text-xs)' }}>
            Fullt navn
            <input
              type="text"
              value={demoForm.fullName}
              onChange={(e) => setDemoForm((f) => ({ ...f, fullName: e.target.value }))}
              placeholder="Fornavn Etternavn"
              style={{
                height: 'var(--touch-min)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-input-border)',
                background: 'var(--color-input-bg)',
                color: 'var(--color-text)',
                padding: '0 var(--space-2)',
                fontSize: 'var(--text-sm)',
              }}
            />
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 'var(--text-xs)' }}>
            Kjønn
            <select
              value={demoForm.gender}
              onChange={(e) => {
                const val = e.target.value;
                const gender = val === 'male' || val === 'female' || val === 'other' ? val : '';
                setDemoForm((f) => ({ ...f, gender }));
              }}
              style={{
                height: 'var(--touch-min)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-input-border)',
                background: 'var(--color-input-bg)',
                color: 'var(--color-text)',
                padding: '0 var(--space-2)',
              }}
            >
              <option value="">Ikke oppgitt</option>
              {GENDER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 'var(--text-xs)' }}>
            Fødselsdato
            <input
              type="date"
              value={demoForm.birthDate}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setDemoForm((f) => ({ ...f, birthDate: e.target.value }))}
              style={{
                height: 'var(--touch-min)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-input-border)',
                background: 'var(--color-input-bg)',
                color: 'var(--color-text)',
                padding: '0 var(--space-2)',
              }}
            />
            {demoForm.birthDate && (() => {
              const age = calculateAgeYears(demoForm.birthDate);
              return (
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-subtle)' }}>
                  Alder: {age != null ? `${age} år` : 'Ukjent'}
                </span>
              );
            })()}
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 'var(--text-xs)' }}>
            Aldersgruppe
            <select
              value={demoForm.ageGroup}
              onChange={(e) => setDemoForm((f) => ({ ...f, ageGroup: e.target.value }))}
              style={{
                height: 'var(--touch-min)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-input-border)',
                background: 'var(--color-input-bg)',
                color: 'var(--color-text)',
                padding: '0 var(--space-2)',
              }}
            >
              <option value="child">Barn</option>
              <option value="adolescent">Ungdom</option>
              <option value="adult">Voksen</option>
              <option value="elderly">Eldre</option>
            </select>
          </label>

          <button
            type="button"
            className="touch-target"
            onClick={handleSubmitDemographics}
            style={{
              minHeight: 'var(--touch-min)',
              borderRadius: 'var(--radius-md)',
              border: 'none',
              background: 'var(--color-brand)',
              color: '#fff',
              fontWeight: 700,
              padding: '0 var(--space-3)',
              cursor: 'pointer',
              alignSelf: 'flex-start',
            }}
          >
            Lagre pasientinfo
          </button>
        </div>
      )}

      {showComplaintEditor && (
        <div
          data-testid={`complaint-editor-${patient.id}`}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-3)',
            background: 'var(--color-surface-sunken)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-3)',
          }}
        >
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 'var(--text-xs)' }}>
            Problemstilling / kort beskrivelse
            <input
              type="text"
              value={complaintDraft}
              onChange={(e) => setComplaintDraft(e.target.value)}
              placeholder="F.eks. Smerter i brystet"
              style={{
                height: 'var(--touch-min)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-input-border)',
                background: 'var(--color-input-bg)',
                color: 'var(--color-text)',
                padding: '0 var(--space-2)',
                fontSize: 'var(--text-sm)',
              }}
            />
          </label>

          <button
            type="button"
            className="touch-target"
            onClick={handleSubmitComplaint}
            style={{
              minHeight: 'var(--touch-min)',
              borderRadius: 'var(--radius-md)',
              border: 'none',
              background: 'var(--color-brand)',
              color: '#fff',
              fontWeight: 700,
              padding: '0 var(--space-3)',
              cursor: 'pointer',
              alignSelf: 'flex-start',
            }}
          >
            Lagre problemstilling
          </button>
        </div>
      )}

      {showMeds && (
        <MedicationPanel
          patientId={patient.id}
          medications={medications}
          form={medForm}
          onChange={setMedForm}
          onSubmit={handleSubmitMedication}
        />
      )}

      {showNote && (
        <NotePanel
          patientId={patient.id}
          form={noteForm}
          onChange={setNoteForm}
          onSubmit={handleSubmitNote}
        />
      )}

      {showVitals && (
        <VitalsEntryForm
          patientId={patient.id}
          form={vitalsForm}
          onChange={setVitalsForm}
          onSubmit={handleSubmitVitals}
        />
      )}

      {showHistory && (
        <PatientHistoryTimeline patient={patient} medications={medications} />
      )}
    </article>
  );
}
