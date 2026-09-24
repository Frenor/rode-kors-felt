import { useState } from 'react';
import {
  ASSIGNMENT_ACK_MINUTES,
  FIELD_TRIAGE_ORDER,
  FIELD_TRIAGE_STYLE,
  TEAM_PATIENT_STATUS_STYLE,
  TRANSPORT_NEED_LABELS,
  minutesSince,
  type FieldTriageStatus,
} from '../../lib/constants';
import { formatRelativeAge } from '../../lib/observation';
import type { FieldOutcome, TeamPatientEngagement, TeamPatientStatus, TransportNeed } from '../../lib/types';
import { Button, Icon, Pill, PatientNumberPill } from '../../components/ui';

export type { FieldTriageStatus } from '../../lib/constants';

export interface FieldPatient {
  id: string;
  label: string | null;
  /** Sick bay intake field; used as the display name when the field label is empty. */
  presentingComplaint?: string | null;
  triageStatus: FieldTriageStatus | null;
  description: string | null;
  positionText: string | null;
  lat: number | null;
  lon: number | null;
  assignedTeamId: string | null;
  updatedAt: string;
  status?: string | null;
  /** Hand-over model (gap A1) — set once the field team has handed the patient off. */
  handedOverAt?: string | null;
  handedOverByTeamId?: string | null;
  fieldOutcome?: FieldOutcome | null;
  /** Shared patient number (gap A5). */
  seq?: number | null;
  /** AMK notified (gap B2 data half). */
  amkNotifiedAt?: string | null;
  amkNotifiedBy?: string | null;
  /** Transport request (gap B3). */
  transportNeed?: TransportNeed | null;
  transportPickupText?: string | null;
  transportRequestedAt?: string | null;
  transportRequestedBy?: string | null;
  transportTeamId?: string | null;
  transportAssignedAt?: string | null;
  /** Sick bay placement (gap B6 / item 8.30 stats tile) — same patient record, sick bay side. */
  placementType?: 'chair' | 'bed' | null;
  placementNumber?: string | null;
}

interface Team {
  id: string;
  name: string;
  transport?: string;
}

interface PatientManagementPanelProps {
  patients: FieldPatient[];
  teams: Team[];
  creating: boolean;
  loading?: boolean;
  onCreatePatient: (data: Omit<FieldPatient, 'id' | 'updatedAt'>) => Promise<void>;
  onUpdatePatient: (id: string, data: Partial<Omit<FieldPatient, 'id' | 'updatedAt'>>) => Promise<void>;
  teamPatientEngagements?: Record<string, TeamPatientEngagement[]>;
  onClosePatient?: (id: string, reason: 'false_alarm' | 'disappeared') => Promise<void>;
  onPickLocation?: (patientId: string) => void;
  /** Transport request (gap B3 / item 8.26) — clears a patient's transport request/assignment. */
  onClearTransport?: (patientId: string) => Promise<void> | void;
  /** Clock for age-based state (acknowledgement); defaults to `new Date()`. */
  now?: Date;
}

const TRIAGE_RANK: Record<string, number> = { red: 0, none: 1, yellow: 2, green: 3, black: 4 };

/** What the coordinator calls this patient: field label, else what is wrong with them. */
export function fieldPatientName(p: Pick<FieldPatient, 'label' | 'presentingComplaint' | 'description'>): string {
  return p.label?.trim() || p.presentingComplaint?.trim() || p.description?.trim() || 'Ukjent pasient';
}

export type AssignmentAck =
  | { kind: 'confirmed'; teamName: string }
  | { kind: 'unconfirmed'; minutes: number }
  | { kind: 'none' };

/**
 * Assignment acknowledgement (gap A4 / item 8.21). A patrol "acknowledges" an
 * assignment by going en route or starting transport for that patient. There
 * is no stored assignment timestamp, so the patient's `updatedAt` — bumped by
 * the assigning PATCH — is used as an honest proxy for "when the assignment
 * happened"; any other edit also bumps it, so this is a proxy, not an exact
 * measurement, and deliberately documented as such here rather than presented
 * as more precise than it is.
 */
export function assignmentAckState(
  patient: Pick<FieldPatient, 'assignedTeamId' | 'updatedAt' | 'status' | 'handedOverAt'>,
  engagements: TeamPatientEngagement[],
  now: Date,
): AssignmentAck {
  if (!patient.assignedTeamId) return { kind: 'none' };
  // Acknowledgement is about a patrol going to a patient in the field: once the
  // patient is in the tent (handed over, in treatment, observation) or closed,
  // there is nothing left to acknowledge.
  if (patient.status !== 'incoming' || patient.handedOverAt) return { kind: 'none' };
  // Any engagement by the assigned patrol (on the way, transporting, or
  // monitoring on site) means they have the patient — that is the acknowledgement.
  const confirmed = engagements.find((e) => e.teamId === patient.assignedTeamId);
  if (confirmed) return { kind: 'confirmed', teamName: confirmed.teamName };
  const minutes = minutesSince(patient.updatedAt, now);
  if (minutes == null) return { kind: 'none' };
  return { kind: 'unconfirmed', minutes };
}

function clockTime(iso?: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' });
}

/** "AMK varslet kl." pill (gap B2 data half / item 8.25) — critical text tone. */
export function AmkNotifiedPill({ patientId, amkNotifiedAt }: { patientId: string; amkNotifiedAt?: string | null }) {
  const clock = clockTime(amkNotifiedAt);
  if (!clock) return null;
  return (
    <Pill
      data-testid={`amk-notified-${patientId}`}
      tone={{ color: 'var(--color-status-critical)', bg: 'var(--color-status-critical-bg)', border: 'var(--color-status-critical-border)' }}
    >
      {`AMK varslet kl. ${clock}`}
    </Pill>
  );
}

/**
 * Transport pill (gap B3 / item 8.26) — "Transport bedt om: ATV" while
 * pending, "Transport: Delta (ATV) · tildelt kl." once a team is assigned.
 */
export function TransportPill({
  patientId,
  transportNeed,
  transportTeamId,
  transportAssignedAt,
  teamName,
}: {
  patientId: string;
  transportNeed?: FieldPatient['transportNeed'];
  transportTeamId?: string | null;
  transportAssignedAt?: string | null;
  teamName?: string | null;
}) {
  if (!transportNeed) return null;
  const need = TRANSPORT_NEED_LABELS[transportNeed];
  if (transportTeamId) {
    const clock = clockTime(transportAssignedAt);
    return (
      <Pill
        data-testid={`transport-pill-${patientId}`}
        tone={{ color: 'var(--color-status-info)', bg: 'var(--color-status-info-bg)', border: 'var(--color-status-info-border)' }}
      >
        {`Transport: ${teamName ?? 'lag'} (${need})${clock ? ` · tildelt kl. ${clock}` : ''}`}
      </Pill>
    );
  }
  return (
    <Pill
      data-testid={`transport-pill-${patientId}`}
      tone={{ color: 'var(--color-status-info)', bg: 'var(--color-status-info-bg)', border: 'var(--color-status-info-border)' }}
    >
      {`Transport bedt om: ${need}`}
    </Pill>
  );
}

/** Assignment-acknowledgement pill shared by the patient row and the attention queue. */
export function AssignmentAckPill({ patientId, ack }: { patientId: string; ack: AssignmentAck }) {
  if (ack.kind === 'confirmed') {
    return (
      <Pill
        data-testid={`ack-confirmed-${patientId}`}
        tone={{ color: 'var(--color-status-ok)', bg: 'var(--color-status-ok-bg)', border: 'var(--color-status-ok-border)' }}
      >
        {`Bekreftet av ${ack.teamName}`}
      </Pill>
    );
  }
  if (ack.kind === 'unconfirmed' && ack.minutes > ASSIGNMENT_ACK_MINUTES.warn) {
    return (
      <Pill
        data-testid={`ack-unconfirmed-${patientId}`}
        tone={{ color: 'var(--color-status-warning)', bg: 'var(--color-status-warning-bg)', border: 'var(--color-status-warning-border)' }}
      >
        {`Ikke bekreftet · ${Math.floor(ack.minutes)} min`}
      </Pill>
    );
  }
  return null;
}

/** Dense coordinator inputs: 44 px, 14 px text. */
const inputStyle = { minHeight: 44, fontSize: 'var(--text-sm)' };

const fieldLabelStyle = { display: 'block', marginBottom: 4 };

function TeamEngagementBadge({ status }: { status: string }) {
  const cfg = TEAM_PATIENT_STATUS_STYLE[status as TeamPatientStatus];
  if (!cfg) return null;
  return <Pill dot tone={{ color: cfg.color, bg: cfg.bg, border: cfg.color }}>{cfg.label}</Pill>;
}

function TriageBadge({ status }: { status: FieldTriageStatus | null }) {
  if (!status) return null;
  const c = FIELD_TRIAGE_STYLE[status];
  return <Pill tone={{ color: c.text, bg: c.bg }}>{c.label}</Pill>;
}

function PatientRow({
  patient,
  teams,
  engagements,
  onUpdate,
  onClose,
  onPickLocation,
  onClearTransport,
  now = new Date(),
}: {
  patient: FieldPatient;
  teams: Team[];
  engagements: TeamPatientEngagement[];
  onUpdate: (data: Partial<Omit<FieldPatient, 'id' | 'updatedAt'>>) => Promise<void>;
  onClose?: (reason: 'false_alarm' | 'disappeared') => Promise<void>;
  onPickLocation?: () => void;
  onClearTransport?: (patientId: string) => Promise<void> | void;
  now?: Date;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ ...patient });
  const [saving, setSaving] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [closing, setClosing] = useState(false);
  const [showCloseMenu, setShowCloseMenu] = useState(false);
  const [closeError, setCloseError] = useState<string | null>(null);
  const [clearingTransport, setClearingTransport] = useState(false);

  const handleClearTransport = async () => {
    if (!onClearTransport) return;
    setClearingTransport(true);
    try {
      await onClearTransport(patient.id);
    } finally {
      setClearingTransport(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    await onUpdate({
      label: draft.label,
      triageStatus: draft.triageStatus,
      description: draft.description,
      positionText: draft.positionText,
      lat: draft.lat,
      lon: draft.lon,
      assignedTeamId: draft.assignedTeamId,
    });
    setSaving(false);
    setEditing(false);
  };

  /** Inline assignment — the coordinator's most frequent action, one interaction. */
  const handleAssign = async (teamId: string) => {
    setAssigning(true);
    try {
      await onUpdate({ assignedTeamId: teamId || null });
    } finally {
      setAssigning(false);
    }
  };

  const handleClose = async (reason: 'false_alarm' | 'disappeared') => {
    if (!onClose) return;
    setClosing(true);
    setShowCloseMenu(false);
    setCloseError(null);
    try {
      await onClose(reason);
    } catch {
      setCloseError('Lukking feilet. Prøv igjen.');
    } finally {
      setClosing(false);
    }
  };

  const isClosed = patient.status === 'discharged' || patient.status === 'transferred';
  // A handed-over patient is in the tent now, not "unassigned" in the sense
  // the warning badge means (gap A1 / item 8.22).
  const isUnassigned = !patient.assignedTeamId && !isClosed && !patient.handedOverAt;
  const assignedTeam = teams.find((t) => t.id === patient.assignedTeamId);
  const hasCoords = patient.lat != null && patient.lon != null;
  const coordsText = hasCoords ? `${patient.lat!.toFixed(5)}, ${patient.lon!.toFixed(5)}` : null;
  // Field reports often carry GPS coordinates but no text — still show *something*.
  const positionSummary = patient.positionText ?? (coordsText ? `GPS ${coordsText}` : null);
  const age = formatRelativeAge(patient.updatedAt);
  const ack = assignmentAckState(patient, engagements, now);

  return (
    <div
      data-testid={`coordinator-patient-${patient.id}`}
      data-unassigned={isUnassigned ? 'true' : undefined}
      className="card card--stripe"
      style={{
        '--stripe': patient.triageStatus ? FIELD_TRIAGE_STYLE[patient.triageStatus].text : 'var(--color-border-strong)',
        borderColor: isUnassigned ? 'var(--color-status-warning-border)' : undefined,
        background: isClosed ? 'var(--color-surface-sunken)' : undefined,
        overflow: 'hidden',
        opacity: isClosed ? 0.7 : 1,
      } as React.CSSProperties}
    >
      {/* Row header */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        style={{
          width: '100%', minHeight: 48, display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap',
          padding: 'var(--space-2) var(--space-3)', background: 'none', border: 'none',
          cursor: 'pointer', textAlign: 'left', color: 'var(--color-text)', font: 'inherit',
        }}
      >
        <TriageBadge status={patient.triageStatus} />
        <PatientNumberPill seq={patient.seq} data-testid={`patient-number-${patient.id}`} />
        <span style={{ flex: 1, minWidth: 120, fontWeight: 700, fontSize: 'var(--text-sm)', textDecoration: isClosed ? 'line-through' : undefined }}>
          {fieldPatientName(patient)}
        </span>
        {isClosed && (
          <Pill tone={{ color: 'var(--color-text-subtle)', bg: 'var(--color-surface-sunken)', border: 'var(--color-border)' }}>
            Lukket
          </Pill>
        )}
        {isUnassigned && (
          <Pill
            data-testid={`unassigned-badge-${patient.id}`}
            tone={{ color: 'var(--color-status-warning)', bg: 'var(--color-status-warning-bg)', border: 'var(--color-status-warning-border)' }}
          >
            Ikke tildelt
          </Pill>
        )}
        {patient.handedOverAt && (
          <Pill
            data-testid={`handed-over-${patient.id}`}
            tone={{ color: 'var(--color-status-info)', bg: 'var(--color-status-info-bg)', border: 'var(--color-status-info-border)' }}
          >
            I sykestua
          </Pill>
        )}
        {assignedTeam && (
          <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--color-text-muted)' }}>
            {assignedTeam.name}
          </span>
        )}
        <AssignmentAckPill patientId={patient.id} ack={ack} />
        <AmkNotifiedPill patientId={patient.id} amkNotifiedAt={patient.amkNotifiedAt} />
        <TransportPill
          patientId={patient.id}
          transportNeed={patient.transportNeed}
          transportTeamId={patient.transportTeamId}
          transportAssignedAt={patient.transportAssignedAt}
          teamName={teams.find((t) => t.id === patient.transportTeamId)?.name}
        />
        {positionSummary && (
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-subtle)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {positionSummary}
          </span>
        )}
        {age && !isClosed && (
          <span className="data" style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-subtle)', whiteSpace: 'nowrap' }}>
            {age}
          </span>
        )}
        <Icon name={expanded ? 'chevronUp' : 'chevronDown'} style={{ color: 'var(--color-text-muted)' }} />
      </button>

      {expanded && !editing && (
        <div style={{ padding: 'var(--space-3)', borderTop: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {patient.description && (
            <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--color-text)' }}>{patient.description}</p>
          )}
          {(patient.positionText || coordsText) && (
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
              <strong>Posisjon:</strong> {patient.positionText ?? 'Kun GPS'}
              {coordsText && ` (${coordsText})`}
            </div>
          )}
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-subtle)' }}>
            Oppdatert <span className="data">{new Date(patient.updatedAt).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })}</span>
          </div>

          {!isClosed && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
              <label htmlFor={`assign-${patient.id}`} style={{ fontSize: 'var(--text-sm)', fontWeight: 700 }}>
                Tilordnet lag
              </label>
              <select
                id={`assign-${patient.id}`}
                data-testid={`assign-select-${patient.id}`}
                className="field"
                value={patient.assignedTeamId ?? ''}
                disabled={assigning}
                onChange={(e) => void handleAssign(e.target.value)}
                style={{
                  ...inputStyle, width: 'auto', minWidth: 180,
                  border: `2px solid ${isUnassigned ? 'var(--color-brand)' : 'var(--color-input-border)'}`,
                  fontWeight: 600,
                }}
              >
                <option value="">— ikke tildelt —</option>
                {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              {assigning && <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>Lagrer…</span>}
            </div>
          )}

          {engagements.length > 0 && (
            <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 'var(--space-2)' }}>
              <div className="section-label" style={{ marginBottom: 'var(--space-1)' }}>
                Lag responderer
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                {engagements.map((eng) => (
                  <div key={eng.teamId} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, minWidth: 80 }}>{eng.teamName}</span>
                    <TeamEngagementBadge status={eng.status} />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', alignItems: 'center' }}>
            {!isClosed && (
              <Button variant="secondary" size="sm" icon="edit" onClick={() => { setDraft({ ...patient }); setEditing(true); }}>
                Rediger detaljer
              </Button>
            )}
            {!isClosed && patient.transportNeed && onClearTransport && (
              <Button
                variant="ghost"
                size="sm"
                icon="x"
                disabled={clearingTransport}
                data-testid={`transport-clear-${patient.id}`}
                onClick={() => void handleClearTransport()}
              >
                {clearingTransport ? 'Fjerner…' : 'Fjern'}
              </Button>
            )}
            {!isClosed && onClose && (
              <div style={{ position: 'relative' }}>
                <Button
                  variant="danger-soft"
                  size="sm"
                  iconEnd="chevronDown"
                  onClick={() => setShowCloseMenu((v) => !v)}
                  disabled={closing}
                  aria-expanded={showCloseMenu}
                >
                  {closing ? 'Lukker...' : 'Lukk pasient'}
                </Button>
                {showCloseMenu && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, zIndex: 20, marginTop: 2,
                    background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-md)',
                    minWidth: 180,
                  }}>
                    <Button variant="ghost" size="sm" block onClick={() => handleClose('false_alarm')} style={{ justifyContent: 'flex-start', borderRadius: 0 }}>
                      Falsk alarm
                    </Button>
                    <Button variant="ghost" size="sm" block onClick={() => handleClose('disappeared')} style={{ justifyContent: 'flex-start', borderRadius: 0 }}>
                      Forsvunnet
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
          {closeError && (
            <p role="alert" style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--color-status-critical)' }}>{closeError}</p>
          )}
        </div>
      )}

      {expanded && editing && (
        <div style={{ padding: 'var(--space-3)', borderTop: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)' }}>
            <div>
              <label htmlFor={`edit-label-${patient.id}`} className="section-label" style={fieldLabelStyle}>Navn / ID</label>
              <input
                id={`edit-label-${patient.id}`}
                type="text"
                value={draft.label ?? ''}
                onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
                className="field" style={inputStyle}
              />
            </div>
            <div>
              <label htmlFor={`edit-triage-${patient.id}`} className="section-label" style={fieldLabelStyle}>Triage</label>
              <select
                id={`edit-triage-${patient.id}`}
                value={draft.triageStatus ?? ''}
                onChange={(e) => setDraft((d) => ({ ...d, triageStatus: (e.target.value || null) as FieldTriageStatus | null }))}
                className="field" style={inputStyle}
              >
                <option value="">— ingen —</option>
                {FIELD_TRIAGE_ORDER.map((t) => <option key={t} value={t}>{FIELD_TRIAGE_STYLE[t].label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor={`edit-description-${patient.id}`} className="section-label" style={fieldLabelStyle}>Notater / beskrivelse</label>
            <textarea
              id={`edit-description-${patient.id}`}
              value={draft.description ?? ''}
              onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value || null }))}
              rows={2}
              className="field" style={{ ...inputStyle, resize: 'vertical' }}
            />
          </div>

          <div>
            <label htmlFor={`edit-position-${patient.id}`} className="section-label" style={fieldLabelStyle}>Posisjonstekst</label>
            <input
              id={`edit-position-${patient.id}`}
              type="text"
              value={draft.positionText ?? ''}
              onChange={(e) => setDraft((d) => ({ ...d, positionText: e.target.value || null }))}
              placeholder="f.eks. Ved hovedscenen, sektor B"
              className="field" style={inputStyle}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)' }}>
            <div>
              <label htmlFor={`edit-lat-${patient.id}`} className="section-label" style={fieldLabelStyle}>Breddegrad (lat)</label>
              <input
                id={`edit-lat-${patient.id}`}
                type="number"
                step="any"
                value={draft.lat ?? ''}
                onChange={(e) => setDraft((d) => ({ ...d, lat: e.target.value ? parseFloat(e.target.value) : null }))}
                className="field" style={inputStyle}
              />
            </div>
            <div>
              <label htmlFor={`edit-lon-${patient.id}`} className="section-label" style={fieldLabelStyle}>Lengdegrad (lon)</label>
              <input
                id={`edit-lon-${patient.id}`}
                type="number"
                step="any"
                value={draft.lon ?? ''}
                onChange={(e) => setDraft((d) => ({ ...d, lon: e.target.value ? parseFloat(e.target.value) : null }))}
                className="field" style={inputStyle}
              />
            </div>
          </div>

          {onPickLocation && (
            <Button variant="secondary" size="sm" icon="pin" onClick={() => onPickLocation()} style={{ alignSelf: 'flex-start', color: 'var(--color-status-info)' }}>
              Pin på kart
            </Button>
          )}

          <div>
            <label htmlFor={`edit-team-${patient.id}`} className="section-label" style={fieldLabelStyle}>Tilordnet lag</label>
            <select
              id={`edit-team-${patient.id}`}
              value={draft.assignedTeamId ?? ''}
              onChange={(e) => setDraft((d) => ({ ...d, assignedTeamId: e.target.value || null }))}
              className="field" style={inputStyle}
            >
              <option value="">— ikke tildelt —</option>
              {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <Button variant="primary" size="sm" onClick={handleSave} disabled={saving || !draft.label?.trim()} style={{ flex: 1 }}>
              {saving ? 'Lagrer...' : 'Lagre'}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
              Avbryt
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function PatientManagementPanel({
  patients,
  teams,
  creating,
  loading,
  onCreatePatient,
  onUpdatePatient,
  teamPatientEngagements = {},
  onClosePatient,
  onPickLocation,
  onClearTransport,
  now = new Date(),
}: PatientManagementPanelProps) {
  const [showForm, setShowForm] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newTriage, setNewTriage] = useState<FieldTriageStatus | ''>('');
  const [newDescription, setNewDescription] = useState('');
  const [newPositionText, setNewPositionText] = useState('');
  const [newTeamId, setNewTeamId] = useState('');
  const [showClosed, setShowClosed] = useState(false);

  const handleCreate = async () => {
    if (!newLabel.trim()) return;
    await onCreatePatient({
      label: newLabel.trim(),
      triageStatus: newTriage || null,
      description: newDescription.trim() || null,
      positionText: newPositionText.trim() || null,
      lat: null,
      lon: null,
      assignedTeamId: newTeamId || null,
    });
    setNewLabel('');
    setNewTriage('');
    setNewDescription('');
    setNewPositionText('');
    setNewTeamId('');
    setShowForm(false);
  };

  const CLOSED_STATUSES = new Set(['discharged', 'transferred']);

  // Worst triage first; within the same triage the ones nobody has taken yet,
  // oldest first — that is the order a coordinator works the list in.
  const activePatients = [...patients]
    .filter((p) => !CLOSED_STATUSES.has(p.status ?? ''))
    .sort((a, b) => {
      const ra = TRIAGE_RANK[a.triageStatus ?? 'none'] ?? 5;
      const rb = TRIAGE_RANK[b.triageStatus ?? 'none'] ?? 5;
      if (ra !== rb) return ra - rb;
      const ua = a.assignedTeamId ? 1 : 0;
      const ub = b.assignedTeamId ? 1 : 0;
      if (ua !== ub) return ua - ub;
      return new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
    });

  const closedPatients = [...patients]
    .filter((p) => CLOSED_STATUSES.has(p.status ?? ''))
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  const unassignedCount = activePatients.filter((p) => !p.assignedTeamId).length;

  return (
    <section
      aria-labelledby="patients-panel-title"
      style={{ marginBottom: 'var(--space-4)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', background: 'var(--color-surface)', overflow: 'hidden' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-2)', padding: 'var(--space-3) var(--space-4)', borderBottom: '1px solid var(--color-border)' }}>
        <h2 id="patients-panel-title" className="section-label" style={{ margin: 0 }}>
          Pasienter (<span className="data">{activePatients.length}</span>)
          {unassignedCount > 0 && (
            <span style={{ marginLeft: 8, color: 'var(--color-status-warning)' }}>· <span className="data">{unassignedCount}</span> uten lag</span>
          )}
          {closedPatients.length > 0 && (
            <span style={{ marginLeft: 8, color: 'var(--color-text-subtle)', fontWeight: 400 }}>· <span className="data">{closedPatients.length}</span> lukket</span>
          )}
        </h2>
        <Button variant={showForm ? 'ghost' : 'outline'} size="sm" icon={showForm ? 'x' : 'plus'} onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Avbryt' : 'Legg til pasient'}
        </Button>
      </div>

      {showForm && (
        <div style={{ padding: 'var(--space-4)', borderBottom: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', background: 'var(--color-surface-sunken)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)' }}>
            <div>
              <label htmlFor="new-patient-label" className="section-label" style={fieldLabelStyle}>Navn / ID *</label>
              <input
                id="new-patient-label"
                type="text"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="f.eks. Pasient 1"
                autoFocus
                className="field" style={inputStyle}
              />
            </div>
            <div>
              <label htmlFor="new-patient-triage" className="section-label" style={fieldLabelStyle}>Triage</label>
              <select
                id="new-patient-triage"
                value={newTriage}
                onChange={(e) => setNewTriage(e.target.value as FieldTriageStatus | '')}
                className="field" style={inputStyle}
              >
                <option value="">— ingen —</option>
                {FIELD_TRIAGE_ORDER.map((t) => <option key={t} value={t}>{FIELD_TRIAGE_STYLE[t].label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="new-patient-description" className="section-label" style={fieldLabelStyle}>Notater / beskrivelse</label>
            <input
              id="new-patient-description"
              type="text"
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="Valgfritt"
              className="field" style={inputStyle}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)' }}>
            <div>
              <label htmlFor="new-patient-position" className="section-label" style={fieldLabelStyle}>Posisjonstekst</label>
              <input
                id="new-patient-position"
                type="text"
                value={newPositionText}
                onChange={(e) => setNewPositionText(e.target.value)}
                placeholder="f.eks. Nær inngangen"
                className="field" style={inputStyle}
              />
            </div>
            <div>
              <label htmlFor="new-patient-team" className="section-label" style={fieldLabelStyle}>Tilordnet lag</label>
              <select
                id="new-patient-team"
                value={newTeamId}
                onChange={(e) => setNewTeamId(e.target.value)}
                className="field" style={inputStyle}
              >
                <option value="">— ikke tildelt —</option>
                {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          </div>
          <Button variant="primary" onClick={handleCreate} disabled={creating || !newLabel.trim()} style={{ alignSelf: 'flex-start' }}>
            {creating ? 'Oppretter...' : 'Opprett pasient'}
          </Button>
        </div>
      )}

      <div style={{ padding: 'var(--space-3)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        {loading && activePatients.length === 0 && closedPatients.length === 0 && (
          <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--color-text-subtle)', textAlign: 'center', padding: 'var(--space-4) 0' }}>
            Laster pasienter…
          </p>
        )}
        {!loading && activePatients.length === 0 && closedPatients.length === 0 && (
          <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--color-text-subtle)', textAlign: 'center', padding: 'var(--space-4) 0' }}>
            Ingen pasienter registrert
          </p>
        )}
        {activePatients.map((p) => (
          <PatientRow
            key={p.id}
            patient={p}
            teams={teams}
            engagements={teamPatientEngagements[p.id] ?? []}
            onUpdate={(data) => onUpdatePatient(p.id, data)}
            onClose={onClosePatient ? (reason) => onClosePatient(p.id, reason) : undefined}
            onPickLocation={onPickLocation ? () => onPickLocation(p.id) : undefined}
            onClearTransport={onClearTransport}
            now={now}
          />
        ))}

        {closedPatients.length > 0 && (
          <div style={{ marginTop: 'var(--space-2)' }}>
            <button type="button" className="disclosure" onClick={() => setShowClosed((v) => !v)} aria-expanded={showClosed}>
              <span>Lukkede pasienter (<span className="data">{closedPatients.length}</span>)</span>
              <Icon name={showClosed ? 'chevronUp' : 'chevronDown'} />
            </button>
            {showClosed && (
              <div style={{ marginTop: 'var(--space-2)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                {closedPatients.map((p) => (
                  <PatientRow
                    key={p.id}
                    patient={p}
                    teams={teams}
                    engagements={teamPatientEngagements[p.id] ?? []}
                    onUpdate={(data) => onUpdatePatient(p.id, data)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
