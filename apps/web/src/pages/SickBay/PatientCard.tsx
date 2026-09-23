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
  FIELD_TRIAGE_STYLE,
  formatPatientAge,
  formatSickbayPlacement,
  freeSickbayNumbers,
  GENDER_LABELS,
  GENDER_OPTIONS,
  news2Colors,
  STATUS_TRANSITIONS,
  statusColors,
  statusLabels,
  TRANSPORT_NEED_LABELS,
  type FieldTriageStatus,
} from '../../lib/constants';
import { describeObservationDue, nextObservationDue } from '../../lib/observation';
import { useNow } from '../../hooks/useNow';
import type { SickBayPatient, MedicationRecord, Team, TeamPatientEngagement } from '../../lib/types';
import { FieldEngagementLine, engagementDistanceLabel } from './FieldEngagementLine';
import { TRANSPORT_LABELS } from '../FirstAider/TeamSettingsPanel';
import { PatientVitalsDisplay } from './PatientVitalsDisplay';
import { PatientActionButtons } from './PatientActionButtons';
import { VitalsEntryForm, type VitalsFormShape } from './VitalsEntryForm';
import { MedicationPanel, type MedFormShape } from './MedicationPanel';
import { NotePanel, type NoteFormShape } from './NotePanel';
import { PatientHistoryTimeline } from './PatientHistoryTimeline';
import { Button, Icon, PatientNumberPill, Pill, type IconName } from '../../components/ui';

/** Chip order for the sick bay's own triage editor (gap A2) — clinically most-to-least urgent
 *  reads oddly here, so this follows the reviewed spec order instead: green, yellow, red, black. */
const SICKBAY_TRIAGE_ORDER: FieldTriageStatus[] = ['green', 'yellow', 'red', 'black'];

function formatClockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' });
}

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
  /** Patrols currently with this patient (på vei / transporterer / overvåker). */
  fieldEngagements?: TeamPatientEngagement[];
  /** Teams in this event — the hand-over line's team name, the "på vei" distance line and the transport line. */
  teams?: Team[];
  /** Other open patients in the event — feeds the placement editor's free-number quick picks (item 8.30). */
  openPatients?: SickBayPatient[];
  /** The latest vitals were recorded offline and are not yet synced (item 8.27). */
  localVitalsPending?: boolean;
  onStatusChange: (status: string) => void;
  onSubmitVitals: (form: VitalsFormShape) => void;
  onSubmitNote: (text: string, author: string) => void;
  onSubmitMedication: (form: MedFormShape) => void;
  onLoadMedications: () => void;
  onOpenAmk: () => void;
  onUpdatePlacement: (placementType: 'chair' | 'bed' | '', placementNumber: string) => void;
  onUpdateDemographics: (form: DemographicsFormShape) => void;
  onUpdateComplaint: (complaint: string) => void;
  /** Triage chips in "Rediger detaljer" (gap A2). */
  onUpdateTriage?: (triage: FieldTriageStatus | null) => void;
}

export function PatientCard({
  patient,
  medications,
  fieldEngagements = [],
  teams = [],
  openPatients = [],
  localVitalsPending = false,
  onStatusChange,
  onSubmitVitals,
  onSubmitNote,
  onSubmitMedication,
  onLoadMedications,
  onOpenAmk,
  onUpdatePlacement,
  onUpdateDemographics,
  onUpdateComplaint,
  onUpdateTriage = () => {},
}: PatientCardProps) {
  const [showVitals, setShowVitals] = useState(false);
  // The three secondary editors sit behind one row so a resting card stays short.
  const [showEditors, setShowEditors] = useState(false);
  const [showMeds, setShowMeds] = useState(false);
  const [showNote, setShowNote] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showPlacementEditor, setShowPlacementEditor] = useState(false);
  const [showDemographicsEditor, setShowDemographicsEditor] = useState(false);
  const [showComplaintEditor, setShowComplaintEditor] = useState(false);
  const [showTriageEditor, setShowTriageEditor] = useState(false);
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
  // Copy follows the locked v3.1 sick bay flow spec.
  const actionCopy: Record<string, { label: string; icon: IconName }> = {
    'incoming:in_treatment': { label: 'Start behandling', icon: 'play' },
    'incoming:observation': { label: 'Legg til observasjon', icon: 'clock' },
    'in_treatment:observation': { label: 'Flytt til observasjon', icon: 'clock' },
    'observation:in_treatment': { label: 'Start behandling', icon: 'play' },
    'in_treatment:discharged': { label: 'Skriv ut', icon: 'check' },
    'observation:discharged': { label: 'Skriv ut', icon: 'check' },
    'in_treatment:transferred': { label: 'Overfør (ambulanse/sykehus)', icon: 'navigate' },
    'observation:transferred': { label: 'Overfør (ambulanse/sykehus)', icon: 'navigate' },
    'discharged:observation': { label: 'Gjenåpne til observasjon', icon: 'refresh' },
    'transferred:observation': { label: 'Gjenåpne til observasjon', icon: 'refresh' },
    'discharged:in_treatment': { label: 'Gjenåpne behandling', icon: 'refresh' },
    'transferred:in_treatment': { label: 'Gjenåpne behandling', icon: 'refresh' },
    'in_treatment:incoming': { label: 'Tilbake til innkommende', icon: 'chevronRight' },
    'observation:incoming': { label: 'Tilbake til innkommende', icon: 'chevronRight' },
  };
  // The one transition that is obviously "next" for this status gets a real
  // button; the rest stay in the dropdown behind the status badge.
  const primaryNextStatus = currentStatus === 'incoming' ? 'in_treatment' : null;

  const news2 = patient.latestVitals ? calculateNEWS2(patient.latestVitals) : null;
  const n2colors = news2 ? news2Colors[news2.alertLevel] : null;

  const now = useNow();
  const isClosed = patient.status === 'discharged' || patient.status === 'transferred';
  const observationDue = isClosed ? { kind: 'none' as const } : nextObservationDue(patient.latestVitals, now);
  const observationText = describeObservationDue(observationDue);
  const observationUrgent = observationDue.kind === 'overdue' || observationDue.kind === 'continuous';

  // Field reports carry a label (e.g. "Brudd / skade") and a free-text
  // description rather than a name and presenting complaint — fall back to
  // them so a patient arriving from a patrol is not shown as "Ukjent pasient".
  const patientName = patient.fullName ?? patient.label ?? patient.presentingComplaint ?? 'Ukjent pasient';
  const fieldTriage = patient.triageStatus ? FIELD_TRIAGE_STYLE[patient.triageStatus] ?? null : null;
  // Hand-over model (gap A1) — the patient stays "incoming", not discharged, once handed off.
  const handoverTeamName = patient.handedOverByTeamId
    ? (teams.find((t) => t.id === patient.handedOverByTeamId)?.name ?? null)
    : null;
  // "På vei" distance (gap A7) — only when a patrol is approaching and both positions are known.
  const distanceLabel = engagementDistanceLabel(fieldEngagements, teams, patient);
  // Transport request (gap B3 / item 8.26) — a field team asked to move this patient.
  const transportTeam = patient.transportTeamId ? teams.find((t) => t.id === patient.transportTeamId) ?? null : null;
  const transportTeamModeLabel = transportTeam?.transport
    ? (TRANSPORT_LABELS[transportTeam.transport as keyof typeof TRANSPORT_LABELS] ?? transportTeam.transport)
    : null;
  const patientAgeLabel = formatPatientAge({
    birthDate: patient.birthDate ?? null,
    ageGroup: patient.ageGroup ?? null,
    ageYears: patient.ageYears ?? null,
  });
  const patientGenderLabel = patient.gender ? GENDER_LABELS[patient.gender] : null;
  const patientDemographics = [patientAgeLabel, patientGenderLabel].filter(Boolean).join(' · ');
  const complaintText = patient.presentingComplaint ?? patient.description ?? 'Problemstilling ikke registrert';
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

  const handleToggleTriageEditor = () => {
    setShowTriageEditor((prev) => !prev);
  };

  const handleSelectTriage = (value: FieldTriageStatus | null) => {
    onUpdateTriage(value);
    setShowTriageEditor(false);
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
      data-observation={observationDue.kind}
      className={`card card--stripe${observationUrgent ? ' card--critical' : ''}`}
      style={{
        '--stripe': fieldTriage?.text ?? 'var(--color-border-strong)',
        padding: 'var(--space-3)',
        display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', height: '100%',
      } as React.CSSProperties}
    >
      {/* Name column gets first claim on width; the badge group wraps under it
          in a narrow grid column instead of clipping the name mid-word. */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, flex: '1 1 160px' }}>
          <span style={{ display: 'flex', alignItems: 'flex-start', gap: 6, minWidth: 0 }}>
            <PatientNumberPill seq={patient.seq} data-testid={`patient-number-${patient.id}`} />
            {fieldTriage && (
              <Pill aria-label={`Felt-triage ${fieldTriage.label}`} tone={{ color: fieldTriage.text, bg: fieldTriage.bg }}>
                {fieldTriage.label}
              </Pill>
            )}
            <span
              style={{
                fontWeight: 700, fontSize: 'var(--text-base)', lineHeight: 1.25,
                display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
              }}
            >
              {patientName}
            </span>
          </span>
          <span
            style={{
              fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', lineHeight: 1.3,
              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
            }}
          >
            {complaintText}
          </span>
          <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--color-text-muted)' }}>
            {`${placementLabel || 'Plassering ikke satt'}${patientDemographics ? ` · ${patientDemographics}` : ''}`}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-1)', alignItems: 'center', flexShrink: 0, marginLeft: 'auto' }}>
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
          {patient.amkNotifiedAt && (
            <Pill
              data-testid={`amk-notified-pill-${patient.id}`}
              tone={{ color: 'var(--color-status-critical)', bg: 'transparent', border: 'transparent' }}
            >
              AMK varslet kl. {formatClockTime(patient.amkNotifiedAt)}
            </Pill>
          )}
          <div ref={statusMenuRef} style={{ position: 'relative' }} data-testid={`patient-status-${patient.id}`}>
            <button
              type="button"
              data-testid={`patient-status-badge-${patient.id}`}
              aria-label={`Status: ${statusLabels[patient.status] ?? patient.status}. Trykk for å endre`}
              aria-expanded={showStatusMenu}
              aria-haspopup="listbox"
              onClick={() => setShowStatusMenu((prev) => !prev)}
              className="pill"
              style={{
                '--pill-bg': sc.bg, '--pill-fg': sc.color,
                minHeight: 32, padding: '3px 8px 3px 10px',
                cursor: nextStatuses.length > 0 ? 'pointer' : 'default',
              } as React.CSSProperties}
            >
              {statusLabels[patient.status] || patient.status}
              {nextStatuses.length > 0 && <Icon name="chevronDown" size="sm" />}
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
                        display: 'flex', width: '100%', alignItems: 'center', gap: 10,
                        padding: 'var(--space-2) var(--space-3)',
                        minHeight: 'var(--touch-min)',
                        border: 'none', borderBottom: '1px solid var(--color-border)',
                        background: 'transparent', cursor: 'pointer', textAlign: 'left',
                        fontSize: 'var(--text-sm)', fontWeight: 600, font: 'inherit',
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
                      {copy?.icon && <Icon name={copy.icon} />}
                      <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>{copy?.label ?? statusLabels[nextStatus]}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {!isClosed && (
        <FieldEngagementLine patientId={patient.id} engagements={fieldEngagements} distanceLabel={distanceLabel} />
      )}

      {/* Hand-over model (gap A1) — the patient is in the tent now, not "finished". */}
      {patient.handedOverAt && (
        <div
          data-testid={`handover-line-${patient.id}`}
          style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--color-text-muted)' }}
        >
          {handoverTeamName
            ? `Overlevert av ${handoverTeamName} kl. ${formatClockTime(patient.handedOverAt)}`
            : `Overlevert kl. ${formatClockTime(patient.handedOverAt)}`}
        </div>
      )}

      {/* Transport request (gap B3 / item 8.26) — what a field team has asked
          to move this patient, and who is coming for them once assigned. */}
      {patient.transportNeed && (
        <div data-testid={`transport-line-${patient.id}`}>
          {patient.transportTeamId ? (
            <Pill tone={{ color: 'var(--color-status-info)', bg: 'var(--color-status-info-bg)' }}>
              Transport: {transportTeam?.name ?? 'Ukjent lag'}
              {transportTeamModeLabel ? ` (${transportTeamModeLabel})` : ''} på vei
            </Pill>
          ) : (
            <Pill tone={{ color: 'var(--color-status-warning)', bg: 'var(--color-status-warning-bg)' }}>
              Transport: {TRANSPORT_NEED_LABELS[patient.transportNeed]}
              {patient.transportRequestedAt ? ` · bedt om kl. ${formatClockTime(patient.transportRequestedAt)}` : ''}
            </Pill>
          )}
        </div>
      )}

      {/* When is this patient due for a new set of observations — the thing a
          busy clinician with six patients forgets first. */}
      {observationText && (
        <div
          data-testid={`observation-due-${patient.id}`}
          role={observationDue.kind === 'overdue' ? 'alert' : undefined}
          style={{
            display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
            padding: 'var(--space-2) var(--space-3)',
            borderRadius: 'var(--radius-sm)',
            background: observationUrgent ? 'var(--color-status-critical-bg)' : 'var(--color-surface-sunken)',
            color: observationUrgent ? 'var(--color-status-critical)' : 'var(--color-text-muted)',
            fontSize: 'var(--text-sm)', fontWeight: observationUrgent ? 700 : 600,
          }}
        >
          <Icon name={observationDue.kind === 'overdue' ? 'alert' : observationDue.kind === 'continuous' ? 'activity' : 'clock'} />
          <span>{observationText}</span>
        </div>
      )}

      {patient.latestVitals && (
        <>
          <PatientVitalsDisplay vitals={patient.latestVitals} />
          {localVitalsPending && (
            <span
              data-testid={`local-vitals-marker-${patient.id}`}
              style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--color-status-warning)' }}
            >
              Lagret lokalt — sendes når tilkoblingen er tilbake
            </span>
          )}
        </>
      )}

      {primaryNextStatus && (
        <Button
          variant="ink"
          size="lg"
          block
          icon="play"
          data-testid={`primary-action-${patient.id}`}
          onClick={() => onStatusChange(primaryNextStatus)}
        >
          {actionCopy[`${currentStatus}:${primaryNextStatus}`]?.label ?? statusLabels[primaryNextStatus]}
        </Button>
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

      {/* Secondary edits — one disclosure row; the three toggles appear when it opens */}
      <button
        type="button"
        className="disclosure"
        data-testid={`edit-details-toggle-${patient.id}`}
        aria-expanded={showEditors}
        onClick={() => setShowEditors((open) => !open)}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <Icon name="edit" size="sm" />
          Rediger detaljer
        </span>
        <Icon name={showEditors ? 'chevronUp' : 'chevronDown'} />
      </button>

      {showEditors && (
      <div style={{ display: 'flex', gap: 'var(--space-1)', flexWrap: 'wrap' }}>
        <Button
          variant="ghost"
          size="sm"
          pill
          icon={showPlacementEditor ? 'x' : 'edit'}
          selected={showPlacementEditor}
          aria-label={showPlacementEditor ? 'Lukk plassering' : 'Rediger plassering'}
          aria-expanded={showPlacementEditor}
          onClick={handleTogglePlacementEditor}
        >
          Plassering
        </Button>

        <Button
          variant="ghost"
          size="sm"
          pill
          icon={showDemographicsEditor ? 'x' : 'edit'}
          selected={showDemographicsEditor}
          aria-label={showDemographicsEditor ? 'Lukk pasientinfo' : 'Rediger pasientinfo'}
          aria-expanded={showDemographicsEditor}
          data-testid={`demographics-editor-toggle-${patient.id}`}
          onClick={handleToggleDemographicsEditor}
        >
          Pasientinfo
        </Button>

        <Button
          variant="ghost"
          size="sm"
          pill
          icon={showComplaintEditor ? 'x' : 'edit'}
          selected={showComplaintEditor}
          aria-label={showComplaintEditor ? 'Lukk problemstilling' : 'Rediger problemstilling'}
          aria-expanded={showComplaintEditor}
          data-testid={`complaint-editor-toggle-${patient.id}`}
          onClick={handleToggleComplaintEditor}
        >
          Beskrivelse
        </Button>

        <Button
          variant="ghost"
          size="sm"
          pill
          icon={showTriageEditor ? 'x' : 'edit'}
          selected={showTriageEditor}
          aria-label={showTriageEditor ? 'Lukk triage' : 'Rediger triage'}
          aria-expanded={showTriageEditor}
          data-testid={`triage-editor-toggle-${patient.id}`}
          onClick={handleToggleTriageEditor}
        >
          Triage
        </Button>

        {/* Printable journal (gap B7 / item 8.32) — a plain link, not a Button,
            so a middle-click / right-click "open in new tab" works like any
            other link; `target="_blank"` covers the ordinary click. */}
        <a
          href={`${import.meta.env.BASE_URL}sickbay/journal/${patient.id}`}
          target="_blank"
          rel="noopener noreferrer"
          data-testid={`journal-link-${patient.id}`}
          className="btn btn--ghost btn--sm btn--pill"
        >
          <Icon name="document" />
          Journal
        </a>
      </div>
      )}

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
            <label className="section-label" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              Type
              <select
                value={placementType}
                onChange={(e) => setPlacementType(e.target.value as 'chair' | 'bed' | '')}
className="field"
              >
                <option value="">Ikke satt</option>
                <option value="chair">Stol</option>
                <option value="bed">Seng</option>
              </select>
            </label>

            <label className="section-label" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              Nummer
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={placementNumber}
                onChange={(e) => setPlacementNumber(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
                placeholder="F.eks. 12"
className="field"
              />
            </label>

            <Button variant="secondary" size="lg" onClick={handleSubmitPlacement}>
              Lagre
            </Button>

            {/* Quick-pick the lowest free numbers for the chosen type (item 8.30) — never
                invented, just the placements not already taken by another open patient. */}
            {placementType && (
              <div
                data-testid={`placement-free-numbers-${patient.id}`}
                style={{ gridColumn: '1 / -1', display: 'flex', flexWrap: 'wrap', gap: 'var(--space-1)' }}
              >
                {freeSickbayNumbers(
                  placementType,
                  openPatients.filter((p) => p.id !== patient.id),
                ).map((n) => (
                  <Button
                    key={n}
                    variant="ghost"
                    size="sm"
                    pill
                    data-testid={`placement-free-${n}`}
                    onClick={() => setPlacementNumber(String(n))}
                  >
                    <span className="data">{n}</span>
                  </Button>
                ))}
              </div>
            )}
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
          <label className="section-label" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            Fullt navn
            <input
              type="text"
              value={demoForm.fullName}
              onChange={(e) => setDemoForm((f) => ({ ...f, fullName: e.target.value }))}
              placeholder="Fornavn Etternavn"
className="field"
            />
          </label>

          <label className="section-label" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            Kjønn
            <select
              value={demoForm.gender}
              onChange={(e) => {
                const val = e.target.value;
                const gender = val === 'male' || val === 'female' || val === 'other' ? val : '';
                setDemoForm((f) => ({ ...f, gender }));
              }}
className="field"
            >
              <option value="">Ikke oppgitt</option>
              {GENDER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </label>

          <label className="section-label" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            Fødselsdato
            <input
              type="date"
              value={demoForm.birthDate}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setDemoForm((f) => ({ ...f, birthDate: e.target.value }))}
className="field"
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

          <label className="section-label" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            Aldersgruppe
            <select
              value={demoForm.ageGroup}
              onChange={(e) => setDemoForm((f) => ({ ...f, ageGroup: e.target.value }))}
className="field"
            >
              <option value="child">Barn</option>
              <option value="adolescent">Ungdom</option>
              <option value="adult">Voksen</option>
              <option value="elderly">Eldre</option>
            </select>
          </label>

          <Button variant="secondary" size="lg" onClick={handleSubmitDemographics} style={{ alignSelf: 'flex-start' }}>
            Lagre pasientinfo
          </Button>
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
          <label className="section-label" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            Problemstilling / kort beskrivelse
            <input
              type="text"
              value={complaintDraft}
              onChange={(e) => setComplaintDraft(e.target.value)}
              placeholder="F.eks. Smerter i brystet"
className="field"
            />
          </label>

          <Button variant="secondary" size="lg" onClick={handleSubmitComplaint} style={{ alignSelf: 'flex-start' }}>
            Lagre problemstilling
          </Button>
        </div>
      )}

      {showTriageEditor && (
        <div
          data-testid={`triage-editor-${patient.id}`}
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
          <span className="section-label">Triage</span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-2)' }}>
            {SICKBAY_TRIAGE_ORDER.map((value) => {
              const style = FIELD_TRIAGE_STYLE[value];
              const active = patient.triageStatus === value;
              return (
                <Button
                  key={value}
                  variant="tone"
                  tone={{ color: style.text, bg: style.bg }}
                  size="lg"
                  aria-pressed={active}
                  icon={active ? 'check' : undefined}
                  data-testid={`triage-chip-${patient.id}-${value}`}
                  onClick={() => handleSelectTriage(value)}
                  style={{ padding: 0 }}
                >
                  {style.label}
                </Button>
              );
            })}
          </div>
          <Button
            variant="ghost"
            size="sm"
            icon="x"
            disabled={!patient.triageStatus}
            data-testid={`triage-clear-${patient.id}`}
            onClick={() => handleSelectTriage(null)}
            style={{ alignSelf: 'flex-start' }}
          >
            Fjern triage
          </Button>
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
