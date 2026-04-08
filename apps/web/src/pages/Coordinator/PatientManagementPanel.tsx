import { useState } from 'react';
import type { TeamPatientEngagement } from '../../lib/types';

export type FieldTriageStatus = 'red' | 'yellow' | 'green' | 'black';

export interface FieldPatient {
  id: string;
  label: string | null;
  triageStatus: FieldTriageStatus | null;
  description: string | null;
  positionText: string | null;
  lat: number | null;
  lon: number | null;
  assignedTeamId: string | null;
  updatedAt: string;
}

interface Team {
  id: string;
  name: string;
}

interface PatientManagementPanelProps {
  patients: FieldPatient[];
  teams: Team[];
  creating: boolean;
  onCreatePatient: (data: Omit<FieldPatient, 'id' | 'updatedAt'>) => Promise<void>;
  onUpdatePatient: (id: string, data: Partial<Omit<FieldPatient, 'id' | 'updatedAt'>>) => Promise<void>;
  teamPatientEngagements?: Record<string, TeamPatientEngagement[]>;
}

const TRIAGE_COLORS: Record<FieldTriageStatus, { bg: string; text: string; label: string }> = {
  red:    { bg: '#fee2e2', text: '#b91c1c', label: 'Rød' },
  yellow: { bg: '#fef9c3', text: '#854d0e', label: 'Gul' },
  green:  { bg: '#dcfce7', text: '#166534', label: 'Grønn' },
  black:  { bg: '#f1f5f9', text: '#1e293b', label: 'Svart' },
};

const TRIAGE_ORDER: FieldTriageStatus[] = ['red', 'yellow', 'green', 'black'];

const TEAM_PATIENT_STATUS_CONFIG = {
  en_route_to_patient: { label: 'På vei', bg: '#fef3c7', text: '#92400e', border: '#f59e0b' },
  transporting:        { label: 'Transporterer', bg: '#dbeafe', text: '#1e40af', border: '#3b82f6' },
  monitoring:          { label: 'Overvåker', bg: '#dcfce7', text: '#166534', border: '#22c55e' },
} as const;

function TeamEngagementBadge({ status }: { status: string }) {
  const cfg = TEAM_PATIENT_STATUS_CONFIG[status as keyof typeof TEAM_PATIENT_STATUS_CONFIG];
  if (!cfg) return null;
  return (
    <span style={{
      display: 'inline-block',
      padding: '1px 7px',
      borderRadius: 'var(--radius-full)',
      background: cfg.bg,
      color: cfg.text,
      border: `1px solid ${cfg.border}`,
      fontSize: 'var(--text-xs)',
      fontWeight: 600,
    }}>
      {cfg.label}
    </span>
  );
}

function TriageBadge({ status }: { status: FieldTriageStatus | null }) {
  if (!status) return null;
  const c = TRIAGE_COLORS[status];
  return (
    <span style={{
      display: 'inline-block',
      padding: '1px 8px',
      borderRadius: 'var(--radius-full)',
      background: c.bg,
      color: c.text,
      fontSize: 'var(--text-xs)',
      fontWeight: 700,
      fontFamily: 'var(--font-mono)',
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
}: {
  patient: FieldPatient;
  teams: Team[];
  engagements: TeamPatientEngagement[];
  onUpdate: (data: Partial<Omit<FieldPatient, 'id' | 'updatedAt'>>) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ ...patient });
  const [saving, setSaving] = useState(false);

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

  const assignedTeam = teams.find((t) => t.id === patient.assignedTeamId);

  return (
    <div style={{
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-md)',
      background: 'var(--color-surface)',
      overflow: 'hidden',
    }}>
      {/* Row header */}
      <button
        onClick={() => setExpanded((v) => !v)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
          padding: 'var(--space-3)', background: 'none', border: 'none',
          cursor: 'pointer', textAlign: 'left',
        }}
      >
        <TriageBadge status={patient.triageStatus} />
        <span className="flex-1 text-sm fw-600">
          {patient.label || 'Ukjent pasient'}
        </span>
        {assignedTeam && (
          <span className="text-xs-subtle">
            {assignedTeam.name}
          </span>
        )}
        {patient.positionText && (
          <span className="text-xs-subtle" style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {patient.positionText}
          </span>
        )}
        <span className="text-xs-subtle">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && !editing && (
        <div className="flex-col gap-2" style={{ padding: 'var(--space-3)', borderTop: '1px solid var(--color-border)' }}>
          {patient.description && (
            <p className="text-sm" style={{ margin: 0, color: 'var(--color-text)' }}>{patient.description}</p>
          )}
          {patient.positionText && (
            <div className="text-xs-subtle">
              <strong>Posisjon:</strong> {patient.positionText}
              {patient.lat != null && patient.lon != null && ` (${patient.lat.toFixed(5)}, ${patient.lon.toFixed(5)})`}
            </div>
          )}
          <div className="text-xs-subtle">
            Oppdatert {new Date(patient.updatedAt).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })}
          </div>
          {engagements.length > 0 && (
            <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 'var(--space-2)', marginTop: 'var(--space-1)' }}>
              <div className="section-label fw-600 mb-1">
                Lag responderer
              </div>
              <div className="flex-col gap-1">
                {engagements.map((eng) => (
                  <div key={eng.teamId} className="flex-align gap-2">
                    <span className="text-sm fw-600" style={{ minWidth: 80 }}>{eng.teamName}</span>
                    <TeamEngagementBadge status={eng.status} />
                  </div>
                ))}
              </div>
            </div>
          )}
          <button
            onClick={() => { setDraft({ ...patient }); setEditing(true); }}
            style={{
              alignSelf: 'flex-start', padding: '4px 12px', borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--color-brand)', background: 'transparent',
              color: 'var(--color-brand)', fontSize: 'var(--text-xs)', fontWeight: 600, cursor: 'pointer',
            }}
          >
            Rediger
          </button>
        </div>
      )}

      {expanded && editing && (
        <div className="flex-col gap-3" style={{ padding: 'var(--space-3)', borderTop: '1px solid var(--color-border)' }}>
          <div className="grid-2">
            <div>
              <label className="text-xs-subtle" style={{ display: 'block', marginBottom: 4 }}>Navn / ID</label>
              <input
                type="text"
                value={draft.label ?? ''}
                onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
                className="form-input-sm"
                style={{ fontSize: 'var(--text-sm)', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label className="text-xs-subtle" style={{ display: 'block', marginBottom: 4 }}>Triage</label>
              <select
                value={draft.triageStatus ?? ''}
                onChange={(e) => setDraft((d) => ({ ...d, triageStatus: (e.target.value || null) as FieldTriageStatus | null }))}
                className="form-input-sm"
                style={{ fontSize: 'var(--text-sm)' }}
              >
                <option value="">— ingen —</option>
                {TRIAGE_ORDER.map((t) => <option key={t} value={t}>{TRIAGE_COLORS[t].label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs-subtle" style={{ display: 'block', marginBottom: 4 }}>Notater / beskrivelse</label>
            <textarea
              value={draft.description ?? ''}
              onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value || null }))}
              rows={2}
              style={{ width: '100%', padding: '6px 8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-input-border)', background: 'var(--color-input-bg)', color: 'var(--color-text)', fontSize: 'var(--text-sm)', resize: 'vertical', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label className="text-xs-subtle" style={{ display: 'block', marginBottom: 4 }}>Posisjonstekst</label>
            <input
              type="text"
              value={draft.positionText ?? ''}
              onChange={(e) => setDraft((d) => ({ ...d, positionText: e.target.value || null }))}
              placeholder="f.eks. Ved hovedscenen, sektor B"
              className="form-input-sm"
              style={{ fontSize: 'var(--text-sm)', boxSizing: 'border-box' }}
            />
          </div>

          <div className="grid-2">
            <div>
              <label className="text-xs-subtle" style={{ display: 'block', marginBottom: 4 }}>Breddegrad (lat)</label>
              <input
                type="number"
                step="any"
                value={draft.lat ?? ''}
                onChange={(e) => setDraft((d) => ({ ...d, lat: e.target.value ? parseFloat(e.target.value) : null }))}
                className="form-input-sm"
                style={{ fontSize: 'var(--text-sm)', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label className="text-xs-subtle" style={{ display: 'block', marginBottom: 4 }}>Lengdegrad (lon)</label>
              <input
                type="number"
                step="any"
                value={draft.lon ?? ''}
                onChange={(e) => setDraft((d) => ({ ...d, lon: e.target.value ? parseFloat(e.target.value) : null }))}
                className="form-input-sm"
                style={{ fontSize: 'var(--text-sm)', boxSizing: 'border-box' }}
              />
            </div>
          </div>

          <div>
            <label className="text-xs-subtle" style={{ display: 'block', marginBottom: 4 }}>Tilordnet lag</label>
            <select
              value={draft.assignedTeamId ?? ''}
              onChange={(e) => setDraft((d) => ({ ...d, assignedTeamId: e.target.value || null }))}
              className="form-input-sm"
              style={{ fontSize: 'var(--text-sm)' }}
            >
              <option value="">— ikke tildelt —</option>
              {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving || !draft.label?.trim()}
              style={{
                flex: 1, height: 36, borderRadius: 'var(--radius-sm)', border: 'none',
                background: 'var(--color-brand)', color: 'white', fontSize: 'var(--text-sm)',
                fontWeight: 600, cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? 'Lagrer...' : 'Lagre'}
            </button>
            <button
              onClick={() => setEditing(false)}
              style={{
                padding: '0 16px', height: 36, borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--color-border)', background: 'transparent',
                color: 'var(--color-text)', fontSize: 'var(--text-sm)', cursor: 'pointer',
              }}
            >
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
  onCreatePatient,
  onUpdatePatient,
  teamPatientEngagements = {},
}: PatientManagementPanelProps) {
  const [showForm, setShowForm] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newTriage, setNewTriage] = useState<FieldTriageStatus | ''>('');
  const [newDescription, setNewDescription] = useState('');
  const [newPositionText, setNewPositionText] = useState('');
  const [newTeamId, setNewTeamId] = useState('');

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

  const sortedPatients = [...patients].sort((a, b) => {
    const order = { red: 0, yellow: 1, green: 2, black: 3 };
    return (order[a.triageStatus ?? 'green'] ?? 2) - (order[b.triageStatus ?? 'green'] ?? 2);
  });

  return (
    <section
      aria-labelledby="patients-panel-title"
      className="card mb-4"
      style={{ overflow: 'hidden' }}
    >
      <div className="flex-between" style={{ padding: 'var(--space-3) var(--space-4)', borderBottom: '1px solid var(--color-border)' }}>
        <h2
          id="patients-panel-title"
          className="section-label text-muted"
          style={{ margin: 0 }}
        >
          Pasienter ({patients.length})
        </h2>
        <button
          onClick={() => setShowForm((v) => !v)}
          style={{
            padding: '4px 12px', borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--color-brand)', background: showForm ? 'var(--color-brand)' : 'transparent',
            color: showForm ? 'white' : 'var(--color-brand)', fontSize: 'var(--text-xs)', fontWeight: 600, cursor: 'pointer',
          }}
        >
          {showForm ? 'Avbryt' : '+ Legg til pasient'}
        </button>
      </div>

      {showForm && (
        <div className="flex-col gap-3" style={{ padding: 'var(--space-4)', borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface-sunken)' }}>
          <div className="grid-2">
            <div>
              <label className="text-xs-subtle" style={{ display: 'block', marginBottom: 4 }}>Navn / ID *</label>
              <input
                type="text"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="f.eks. Pasient 1"
                autoFocus
                className="form-input-sm"
                style={{ fontSize: 'var(--text-sm)', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label className="text-xs-subtle" style={{ display: 'block', marginBottom: 4 }}>Triage</label>
              <select
                value={newTriage}
                onChange={(e) => setNewTriage(e.target.value as FieldTriageStatus | '')}
                className="form-input-sm"
                style={{ fontSize: 'var(--text-sm)' }}
              >
                <option value="">— ingen —</option>
                {TRIAGE_ORDER.map((t) => <option key={t} value={t}>{TRIAGE_COLORS[t].label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs-subtle" style={{ display: 'block', marginBottom: 4 }}>Notater / beskrivelse</label>
            <input
              type="text"
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="Valgfritt"
              className="form-input-sm"
              style={{ fontSize: 'var(--text-sm)', boxSizing: 'border-box' }}
            />
          </div>
          <div className="grid-2">
            <div>
              <label className="text-xs-subtle" style={{ display: 'block', marginBottom: 4 }}>Posisjonstekst</label>
              <input
                type="text"
                value={newPositionText}
                onChange={(e) => setNewPositionText(e.target.value)}
                placeholder="f.eks. Nær inngangen"
                className="form-input-sm"
                style={{ fontSize: 'var(--text-sm)', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label className="text-xs-subtle" style={{ display: 'block', marginBottom: 4 }}>Tilordnet lag</label>
              <select
                value={newTeamId}
                onChange={(e) => setNewTeamId(e.target.value)}
                className="form-input-sm"
                style={{ fontSize: 'var(--text-sm)' }}
              >
                <option value="">— ikke tildelt —</option>
                {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          </div>
          <button
            onClick={handleCreate}
            disabled={creating || !newLabel.trim()}
            style={{
              alignSelf: 'flex-start', padding: '0 20px', height: 36,
              borderRadius: 'var(--radius-sm)', border: 'none',
              background: newLabel.trim() ? 'var(--color-brand)' : 'var(--color-border)',
              color: newLabel.trim() ? 'white' : 'var(--color-text-subtle)',
              fontSize: 'var(--text-sm)', fontWeight: 600,
              cursor: creating || !newLabel.trim() ? 'not-allowed' : 'pointer',
            }}
          >
            {creating ? 'Oppretter...' : 'Opprett pasient'}
          </button>
        </div>
      )}

      <div className="flex-col gap-2" style={{ padding: 'var(--space-3)' }}>
        {sortedPatients.length === 0 && (
          <p className="text-sm text-subtle" style={{ margin: 0, textAlign: 'center', padding: 'var(--space-4) 0' }}>
            Ingen pasienter registrert
          </p>
        )}
        {sortedPatients.map((p) => (
          <PatientRow
            key={p.id}
            patient={p}
            teams={teams}
            engagements={teamPatientEngagements[p.id] ?? []}
            onUpdate={(data) => onUpdatePatient(p.id, data)}
          />
        ))}
      </div>
    </section>
  );
}
