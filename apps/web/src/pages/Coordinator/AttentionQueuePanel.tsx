/**
 * AttentionQueuePanel — "Krever handling".
 *
 * One ordered list of everything that needs a coordinator decision right now,
 * with the decision inline:
 *   1. patrols that asked for assistance,
 *   2. open patients nobody is assigned to (worst triage first, then oldest),
 *   3. patients whose NEWS2 is rising fast.
 *
 * Before this the same items were spread over three panels and the patient
 * list, and assigning a team took four interactions in an edit form.
 */
import { useState } from 'react';
import {
  FIELD_TRIAGE_STYLE,
  TEAM_OPERATIONAL_STATUS_LABELS,
  type FieldTriageStatus,
} from '../../lib/constants';
import { formatRelativeAge } from '../../lib/observation';
import type { DeteriorationAlert, Team } from '../../lib/types';
import { fieldPatientName, type FieldPatient } from './PatientManagementPanel';

interface AttentionQueuePanelProps {
  teams: Team[];
  patients: FieldPatient[];
  alerts: DeteriorationAlert[];
  onAssignTeam: (patientId: string, teamId: string) => Promise<void> | void;
  onDismissAlert: (patientId: string) => void;
  now?: Date;
}

const CLOSED = new Set(['discharged', 'transferred']);
/** Untriaged is ranked right after red: nobody has looked at it yet. */
const TRIAGE_RANK: Record<string, number> = { red: 0, none: 1, yellow: 2, green: 3, black: 4 };

function clock(iso?: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' });
}

const rowStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-3)',
  flexWrap: 'wrap' as const,
  padding: 'var(--space-2) var(--space-3)',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
};

const groupHeadingStyle = {
  margin: '0 0 var(--space-2)',
  fontSize: 'var(--text-xs)',
  fontFamily: 'var(--font-mono)',
  letterSpacing: 'var(--tracking-mono)',
  textTransform: 'uppercase' as const,
  color: 'var(--color-text-muted)',
};

export function AttentionQueuePanel({
  teams,
  patients,
  alerts,
  onAssignTeam,
  onDismissAlert,
  now = new Date(),
}: AttentionQueuePanelProps) {
  const [assigning, setAssigning] = useState<Record<string, boolean>>({});

  const needsAssistance = teams
    .filter((t) => t.operationalStatus === 'needs_assistance')
    .sort((a, b) => (a.statusUpdatedAt ?? '').localeCompare(b.statusUpdatedAt ?? ''));

  const unassigned = patients
    .filter((p) => !p.assignedTeamId && !CLOSED.has(p.status ?? ''))
    .sort((a, b) => {
      const ra = TRIAGE_RANK[a.triageStatus ?? 'none'] ?? 5;
      const rb = TRIAGE_RANK[b.triageStatus ?? 'none'] ?? 5;
      if (ra !== rb) return ra - rb;
      return new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
    });

  const total = needsAssistance.length + unassigned.length + alerts.length;
  const teamName = (id: string | null | undefined) => teams.find((t) => t.id === id)?.name ?? null;

  const assign = async (patientId: string, teamId: string) => {
    if (!teamId) return;
    setAssigning((prev) => ({ ...prev, [patientId]: true }));
    try {
      await onAssignTeam(patientId, teamId);
    } finally {
      setAssigning((prev) => {
        const next = { ...prev };
        delete next[patientId];
        return next;
      });
    }
  };

  return (
    <section
      aria-labelledby="attention-queue-title"
      data-testid="coordinator-attention-queue"
      style={{
        marginBottom: 'var(--space-4)',
        border: `2px solid ${total > 0 ? 'var(--color-status-critical)' : 'var(--color-border)'}`,
        borderRadius: 'var(--radius-md)',
        background: total > 0 ? 'var(--color-status-critical-bg)' : 'var(--color-surface)',
        overflow: 'hidden',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-2)', padding: 'var(--space-3) var(--space-4)' }}>
        <h2
          id="attention-queue-title"
          style={{ margin: 0, fontSize: 'var(--text-base)', fontWeight: 700, color: total > 0 ? 'var(--color-status-critical)' : 'var(--color-text)' }}
        >
          Krever handling
        </h2>
        <span
          data-testid="attention-queue-count"
          aria-live="polite"
          style={{
            fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', fontWeight: 700,
            padding: '2px 12px', borderRadius: 'var(--radius-full)',
            background: total > 0 ? 'var(--color-status-critical)' : 'var(--color-status-ok-bg)',
            color: total > 0 ? 'white' : 'var(--color-status-ok)',
          }}
        >
          {total === 0 ? 'Ingen ventende' : `${total} ${total === 1 ? 'oppgave' : 'oppgaver'}`}
        </span>
      </div>

      {total === 0 ? (
        <p
          data-testid="attention-queue-empty"
          style={{ margin: 0, padding: '0 var(--space-4) var(--space-3)', fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}
        >
          Alle åpne pasienter har et lag, og ingen lag ber om bistand.
        </p>
      ) : (
        <div style={{ padding: '0 var(--space-3) var(--space-3)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {needsAssistance.length > 0 && (
            <div>
              <h3 style={groupHeadingStyle}>Lag som trenger bistand</h3>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                {needsAssistance.map((team) => (
                  <li key={team.id} data-testid={`attention-team-${team.id}`} style={{ ...rowStyle, border: '1px solid var(--color-status-critical)' }}>
                    <span style={{ fontWeight: 700, fontSize: 'var(--text-base)', color: 'var(--color-status-critical)' }}>
                      {team.name}
                    </span>
                    <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text)', flex: 1, minWidth: 120 }}>
                      {team.statusNote || TEAM_OPERATIONAL_STATUS_LABELS.needs_assistance}
                    </span>
                    {clock(team.statusUpdatedAt) && (
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                        siden kl. {clock(team.statusUpdatedAt)}
                        {team.contactRadio ? ` · ISSI ${team.contactRadio}` : ''}
                        {team.contactPhone ? ` · ${team.contactPhone}` : ''}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {unassigned.length > 0 && (
            <div>
              <h3 style={groupHeadingStyle}>Pasienter uten lag</h3>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                {unassigned.map((patient) => {
                  const triage = patient.triageStatus ? FIELD_TRIAGE_STYLE[patient.triageStatus as FieldTriageStatus] : null;
                  const where = patient.positionText
                    ?? (patient.lat != null && patient.lon != null ? `GPS ${patient.lat.toFixed(4)}, ${patient.lon.toFixed(4)}` : null);
                  return (
                    <li key={patient.id} data-testid={`attention-patient-${patient.id}`} style={rowStyle}>
                      <span
                        style={{
                          flexShrink: 0, padding: '2px 10px', borderRadius: 'var(--radius-full)',
                          background: triage?.bg ?? 'var(--color-surface-sunken)',
                          color: triage?.text ?? 'var(--color-text-muted)',
                          fontSize: 'var(--text-xs)', fontWeight: 700, fontFamily: 'var(--font-mono)',
                        }}
                      >
                        {triage?.label ?? 'Ikke triagert'}
                      </span>
                      <span style={{ fontWeight: 700, fontSize: 'var(--text-base)', minWidth: 0 }}>
                        {fieldPatientName(patient)}
                      </span>
                      <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', flex: 1, minWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {where ?? 'Posisjon ukjent'} · meldt {formatRelativeAge(patient.updatedAt, now)}
                      </span>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 'var(--text-sm)', fontWeight: 600 }}>
                        <span className="sr-only">Tildel lag til {fieldPatientName(patient)}</span>
                        <select
                          data-testid={`attention-assign-${patient.id}`}
                          value=""
                          disabled={!!assigning[patient.id] || teams.length === 0}
                          onChange={(e) => void assign(patient.id, e.target.value)}
                          style={{
                            minHeight: 44, minWidth: 180, padding: '0 var(--space-2)',
                            borderRadius: 'var(--radius-sm)', border: '2px solid var(--color-brand)',
                            background: 'var(--color-input-bg)', color: 'var(--color-brand)',
                            fontSize: 'var(--text-sm)', fontWeight: 700, cursor: 'pointer',
                          }}
                        >
                          <option value="">{assigning[patient.id] ? 'Tildeler…' : teams.length === 0 ? 'Ingen lag' : 'Tildel lag…'}</option>
                          {teams.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name} — {TEAM_OPERATIONAL_STATUS_LABELS[t.operationalStatus ?? 'available'] ?? t.operationalStatus}
                            </option>
                          ))}
                        </select>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {alerts.length > 0 && (
            <div>
              <h3 style={groupHeadingStyle}>NEWS2 stiger raskt</h3>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                {[...alerts].sort((a, b) => b.ratePerHour - a.ratePerHour).map((alert) => {
                  const patient = patients.find((p) => p.id === alert.patientId);
                  const label = patient ? fieldPatientName(patient) : `Pasient ${alert.patientId.slice(0, 8)}`;
                  const team = teamName(patient?.assignedTeamId);
                  return (
                    <li key={alert.patientId} data-testid={`attention-alert-${alert.patientId}`} style={{ ...rowStyle, border: '1px solid var(--color-status-critical)' }}>
                      <span style={{ fontWeight: 700, fontSize: 'var(--text-base)' }}>{label}</span>
                      <span
                        style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--color-status-critical)' }}
                        aria-label={`NEWS2 stiger — score ${alert.news2Score}, pluss ${alert.ratePerHour.toFixed(1)} poeng per time`}
                      >
                        NEWS2 {alert.news2Score} · +{alert.ratePerHour.toFixed(1)}/t
                      </span>
                      <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', flex: 1 }}>
                        {team ? `Lag: ${team}` : patient ? 'Ikke tildelt lag' : ''}
                        {patient?.positionText ? ` · ${patient.positionText}` : ''}
                        {' · '}{formatRelativeAge(alert.receivedAt, now)}
                      </span>
                      <button
                        type="button"
                        onClick={() => onDismissAlert(alert.patientId)}
                        aria-label={`Fjern varsel for ${label}`}
                        style={{
                          minHeight: 44, padding: '0 var(--space-3)',
                          borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)',
                          background: 'transparent', color: 'var(--color-text-muted)',
                          fontSize: 'var(--text-sm)', fontWeight: 600, cursor: 'pointer',
                        }}
                      >
                        Sett
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
