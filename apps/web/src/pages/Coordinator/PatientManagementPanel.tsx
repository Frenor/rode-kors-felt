import { useState } from 'react';
import {
  FIELD_TRIAGE_ORDER,
  FIELD_TRIAGE_STYLE,
  TEAM_PATIENT_STATUS_STYLE,
  type FieldTriageStatus,
} from '../../lib/constants';
import { formatRelativeAge } from '../../lib/observation';
import type { TeamPatientEngagement, TeamPatientStatus } from '../../lib/types';

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
}

interface Team {
  id: string;
  name: string;
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
}

const TRIAGE_RANK: Record<string, number> = { red: 0, none: 1, yellow: 2, green: 3, black: 4 };

/** What the coordinator calls this patient: field label, else what is wrong with them. */
export function fieldPatientName(p: Pick<FieldPatient, 'label' | 'presentingComplaint' | 'description'>): string {
  return p.label?.trim() || p.presentingComplaint?.trim() || p.description?.trim() || 'Ukjent pasient';
}

const inputStyle = {
  width: '100%',
  minHeight: 44,
  padding: '0 var(--space-2)',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--color-input-border)',
  background: 'var(--color-input-bg)',
  color: 'var(--color-text)',
  fontSize: 'var(--text-sm)',
  boxSizing: 'border-box' as const,
};

const fieldLabelStyle = {
  display: 'block',
  fontSize: 'var(--text-xs)',
  color: 'var(--color-text-muted)',
  marginBottom: 4,
  fontWeight: 600,
};

const secondaryButtonStyle = {
  minHeight: 44,
  padding: '0 var(--space-3)',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--color-border)',
  background: 'transparent',
  color: 'var(--color-text)',
  fontSize: 'var(--text-sm)',
  fontWeight: 600,
  cursor: 'pointer',
};

function TeamEngagementBadge({ status }: { status: string }) {
  const cfg = TEAM_PATIENT_STATUS_STYLE[status as TeamPatientStatus];
  if (!cfg) return null;
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: 'var(--radius-full)',
      background: cfg.bg,
      color: cfg.color,
      border: `1px solid ${cfg.color}`,
      fontSize: 'var(--text-xs)',
      fontWeight: 700,
    }}>
      {cfg.label}
    </span>
  );
}

function TriageBadge({ status }: { status: FieldTriageStatus | null }) {
  if (!status) return null;
  const c = FIELD_TRIAGE_STYLE[status];
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 10px',
      borderRadius: 'var(--radius-full)',
      background: c.bg,
      color: c.text,
      fontSize: 'var(--text-xs)',
      fontWeight: 700,
      fontFamily: 'var(--font-mono)',
      flexShrink: 0,
    }}>
      {c.label}
    </span>
  );
}

function PatientRow({
  patient,
  teams,
  engagements,
  onUpdate,
  onClose,
  onPickLocation,
}: {
  patient: FieldPatient;
  teams: Team[];
  engagements: TeamPatientEngagement[];
  onUpdate: (data: Partial<Omit<FieldPatient, 'id' | 'updatedAt'>>) => Promise<void>;
  onClose?: (reason: 'false_alarm' | 'disappeared') => Promise<void>;
  onPickLocation?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ ...patient });
  const [saving, setSaving] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [closing, setClosing] = useState(false);
  const [showCloseMenu, setShowCloseMenu] = useState(false);
  const [closeError, setCloseError] = useState<string | null>(null);

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
  const isUnassigned = !patient.assignedTeamId && !isClosed;
  const assignedTeam = teams.find((t) => t.id === patient.assignedTeamId);
  const hasCoords = patient.lat != null && patient.lon != null;
  const coordsText = hasCoords ? `${patient.lat!.toFixed(5)}, ${patient.lon!.toFixed(5)}` : null;
  // Field reports often carry GPS coordinates but no text — still show *something*.
  const positionSummary = patient.positionText ?? (coordsText ? `GPS ${coordsText}` : null);
  const age = formatRelativeAge(patient.updatedAt);

  return (
    <div
      data-testid={`coordinator-patient-${patient.id}`}
      data-unassigned={isUnassigned ? 'true' : undefined}
      style={{
        border: `1px solid ${isUnassigned ? 'var(--color-status-warning-border)' : 'var(--color-border)'}`,
        borderRadius: 'var(--radius-md)',
        background: isClosed ? 'var(--color-surface-sunken)' : 'var(--color-surface)',
        overflow: 'hidden',
        opacity: isClosed ? 0.7 : 1,
      }}
    >
      {/* Row header */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        style={{
          width: '100%', minHeight: 48, display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap',
          padding: 'var(--space-2) var(--space-3)', background: 'none', border: 'none',
          cursor: 'pointer', textAlign: 'left', color: 'var(--color-text)',
        }}
      >
        <TriageBadge status={patient.triageStatus} />
        <span style={{ flex: 1, minWidth: 120, fontWeight: 700, fontSize: 'var(--text-sm)', textDecoration: isClosed ? 'line-through' : undefined }}>
          {fieldPatientName(patient)}
        </span>
        {isClosed && (
          <span style={{ fontSize: 'var(--text-xs)', padding: '2px 8px', borderRadius: 'var(--radius-full)', background: 'var(--color-surface-sunken)', color: 'var(--color-text-subtle)', border: '1px solid var(--color-border)' }}>
            Lukket
          </span>
        )}
        {isUnassigned && (
          <span
            data-testid={`unassigned-badge-${patient.id}`}
            style={{ fontSize: 'var(--text-xs)', fontWeight: 700, padding: '2px 8px', borderRadius: 'var(--radius-full)', background: 'var(--color-status-warning-bg)', color: 'var(--color-status-warning)', border: '1px solid var(--color-status-warning-border)' }}
          >
            Ikke tildelt
          </span>
        )}
        {assignedTeam && (
          <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--color-text-muted)' }}>
            {assignedTeam.name}
          </span>
        )}
        {positionSummary && (
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-subtle)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {positionSummary}
          </span>
        )}
        {age && !isClosed && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--color-text-subtle)', whiteSpace: 'nowrap' }}>
            {age}
          </span>
        )}
        <span aria-hidden="true" style={{ color: 'var(--color-text-subtle)', fontSize: 'var(--text-xs)' }}>{expanded ? '▲' : '▼'}</span>
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
            Oppdatert {new Date(patient.updatedAt).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })}
          </div>

          {!isClosed && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
              <label htmlFor={`assign-${patient.id}`} style={{ fontSize: 'var(--text-sm)', fontWeight: 700 }}>
                Tilordnet lag
              </label>
              <select
                id={`assign-${patient.id}`}
                data-testid={`assign-select-${patient.id}`}
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
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-1)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
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
              <button
                type="button"
                onClick={() => { setDraft({ ...patient }); setEditing(true); }}
                style={{ ...secondaryButtonStyle, border: '1px solid var(--color-brand)', color: 'var(--color-brand)' }}
              >
                Rediger detaljer
              </button>
            )}
            {!isClosed && onClose && (
              <div style={{ position: 'relative' }}>
                <button
                  type="button"
                  onClick={() => setShowCloseMenu((v) => !v)}
                  disabled={closing}
                  aria-expanded={showCloseMenu}
                  style={{
                    ...secondaryButtonStyle,
                    border: '1px solid var(--color-status-critical)',
                    color: 'var(--color-status-critical)',
                    cursor: closing ? 'wait' : 'pointer',
                  }}
                >
                  {closing ? 'Lukker...' : 'Lukk pasient ▾'}
                </button>
                {showCloseMenu && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, zIndex: 20, marginTop: 2,
                    background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-md)',
                    minWidth: 180,
                  }}>
                    <button
                      type="button"
                      onClick={() => handleClose('false_alarm')}
                      style={{ display: 'block', width: '100%', minHeight: 44, textAlign: 'left', padding: '0 12px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text)' }}
                    >
                      Falsk alarm
                    </button>
                    <button
                      type="button"
                      onClick={() => handleClose('disappeared')}
                      style={{ display: 'block', width: '100%', minHeight: 44, textAlign: 'left', padding: '0 12px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text)' }}
                    >
                      Forsvunnet
                    </button>
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
              <label htmlFor={`edit-label-${patient.id}`} style={fieldLabelStyle}>Navn / ID</label>
              <input
                id={`edit-label-${patient.id}`}
                type="text"
                value={draft.label ?? ''}
                onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
                style={inputStyle}
              />
            </div>
            <div>
              <label htmlFor={`edit-triage-${patient.id}`} style={fieldLabelStyle}>Triage</label>
              <select
                id={`edit-triage-${patient.id}`}
                value={draft.triageStatus ?? ''}
                onChange={(e) => setDraft((d) => ({ ...d, triageStatus: (e.target.value || null) as FieldTriageStatus | null }))}
                style={inputStyle}
              >
                <option value="">— ingen —</option>
                {FIELD_TRIAGE_ORDER.map((t) => <option key={t} value={t}>{FIELD_TRIAGE_STYLE[t].label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor={`edit-description-${patient.id}`} style={fieldLabelStyle}>Notater / beskrivelse</label>
            <textarea
              id={`edit-description-${patient.id}`}
              value={draft.description ?? ''}
              onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value || null }))}
              rows={2}
              style={{ ...inputStyle, padding: 'var(--space-2)', resize: 'vertical' }}
            />
          </div>

          <div>
            <label htmlFor={`edit-position-${patient.id}`} style={fieldLabelStyle}>Posisjonstekst</label>
            <input
              id={`edit-position-${patient.id}`}
              type="text"
              value={draft.positionText ?? ''}
              onChange={(e) => setDraft((d) => ({ ...d, positionText: e.target.value || null }))}
              placeholder="f.eks. Ved hovedscenen, sektor B"
              style={inputStyle}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)' }}>
            <div>
              <label htmlFor={`edit-lat-${patient.id}`} style={fieldLabelStyle}>Breddegrad (lat)</label>
              <input
                id={`edit-lat-${patient.id}`}
                type="number"
                step="any"
                value={draft.lat ?? ''}
                onChange={(e) => setDraft((d) => ({ ...d, lat: e.target.value ? parseFloat(e.target.value) : null }))}
                style={inputStyle}
              />
            </div>
            <div>
              <label htmlFor={`edit-lon-${patient.id}`} style={fieldLabelStyle}>Lengdegrad (lon)</label>
              <input
                id={`edit-lon-${patient.id}`}
                type="number"
                step="any"
                value={draft.lon ?? ''}
                onChange={(e) => setDraft((d) => ({ ...d, lon: e.target.value ? parseFloat(e.target.value) : null }))}
                style={inputStyle}
              />
            </div>
          </div>

          {onPickLocation && (
            <button
              type="button"
              onClick={() => onPickLocation()}
              style={{ ...secondaryButtonStyle, alignSelf: 'flex-start', border: '1px solid var(--color-status-info)', color: 'var(--color-status-info)' }}
            >
              Pin på kart
            </button>
          )}

          <div>
            <label htmlFor={`edit-team-${patient.id}`} style={fieldLabelStyle}>Tilordnet lag</label>
            <select
              id={`edit-team-${patient.id}`}
              value={draft.assignedTeamId ?? ''}
              onChange={(e) => setDraft((d) => ({ ...d, assignedTeamId: e.target.value || null }))}
              style={inputStyle}
            >
              <option value="">— ikke tildelt —</option>
              {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !draft.label?.trim()}
              style={{
                flex: 1, minHeight: 44, borderRadius: 'var(--radius-sm)', border: 'none',
                background: 'var(--color-brand)', color: 'white', fontSize: 'var(--text-sm)',
                fontWeight: 700, cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? 'Lagrer...' : 'Lagre'}
            </button>
            <button type="button" onClick={() => setEditing(false)} style={secondaryButtonStyle}>
              Avbryt
            </button>
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
        <h2
          id="patients-panel-title"
          style={{ margin: 0, fontSize: 'var(--text-sm)', fontFamily: 'var(--font-mono)', letterSpacing: 'var(--tracking-mono)', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}
        >
          Pasienter ({activePatients.length})
          {unassignedCount > 0 && (
            <span style={{ marginLeft: 8, color: 'var(--color-status-warning)' }}>· {unassignedCount} uten lag</span>
          )}
          {closedPatients.length > 0 && (
            <span style={{ marginLeft: 8, color: 'var(--color-text-subtle)', fontWeight: 400 }}>· {closedPatients.length} lukket</span>
          )}
        </h2>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          style={{
            minHeight: 44, padding: '0 var(--space-3)', borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--color-brand)', background: showForm ? 'var(--color-brand)' : 'transparent',
            color: showForm ? 'white' : 'var(--color-brand)', fontSize: 'var(--text-sm)', fontWeight: 700, cursor: 'pointer',
          }}
        >
          {showForm ? 'Avbryt' : '+ Legg til pasient'}
        </button>
      </div>

      {showForm && (
        <div style={{ padding: 'var(--space-4)', borderBottom: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', background: 'var(--color-surface-sunken)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)' }}>
            <div>
              <label htmlFor="new-patient-label" style={fieldLabelStyle}>Navn / ID *</label>
              <input
                id="new-patient-label"
                type="text"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="f.eks. Pasient 1"
                autoFocus
                style={inputStyle}
              />
            </div>
            <div>
              <label htmlFor="new-patient-triage" style={fieldLabelStyle}>Triage</label>
              <select
                id="new-patient-triage"
                value={newTriage}
                onChange={(e) => setNewTriage(e.target.value as FieldTriageStatus | '')}
                style={inputStyle}
              >
                <option value="">— ingen —</option>
                {FIELD_TRIAGE_ORDER.map((t) => <option key={t} value={t}>{FIELD_TRIAGE_STYLE[t].label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="new-patient-description" style={fieldLabelStyle}>Notater / beskrivelse</label>
            <input
              id="new-patient-description"
              type="text"
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="Valgfritt"
              style={inputStyle}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)' }}>
            <div>
              <label htmlFor="new-patient-position" style={fieldLabelStyle}>Posisjonstekst</label>
              <input
                id="new-patient-position"
                type="text"
                value={newPositionText}
                onChange={(e) => setNewPositionText(e.target.value)}
                placeholder="f.eks. Nær inngangen"
                style={inputStyle}
              />
            </div>
            <div>
              <label htmlFor="new-patient-team" style={fieldLabelStyle}>Tilordnet lag</label>
              <select
                id="new-patient-team"
                value={newTeamId}
                onChange={(e) => setNewTeamId(e.target.value)}
                style={inputStyle}
              >
                <option value="">— ikke tildelt —</option>
                {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          </div>
          <button
            type="button"
            onClick={handleCreate}
            disabled={creating || !newLabel.trim()}
            style={{
              alignSelf: 'flex-start', padding: '0 20px', minHeight: 44,
              borderRadius: 'var(--radius-sm)', border: 'none',
              background: newLabel.trim() ? 'var(--color-brand)' : 'var(--color-border)',
              color: newLabel.trim() ? 'white' : 'var(--color-text-subtle)',
              fontSize: 'var(--text-sm)', fontWeight: 700,
              cursor: creating || !newLabel.trim() ? 'not-allowed' : 'pointer',
            }}
          >
            {creating ? 'Oppretter...' : 'Opprett pasient'}
          </button>
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
          />
        ))}

        {closedPatients.length > 0 && (
          <div style={{ marginTop: 'var(--space-2)' }}>
            <button
              type="button"
              onClick={() => setShowClosed((v) => !v)}
              aria-expanded={showClosed}
              style={{
                width: '100%', minHeight: 44, padding: '0 var(--space-3)', background: 'none', border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 'var(--text-sm)',
                color: 'var(--color-text-muted)', fontWeight: 600, textAlign: 'left',
              }}
            >
              {showClosed ? '▲' : '▼'} Lukkede pasienter ({closedPatients.length})
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
