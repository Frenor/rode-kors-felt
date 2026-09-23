/**
 * AttentionQueuePanel — "Krever handling".
 *
 * A coordinator decision right now, with the decision inline. Five things put
 * a row here: a patrol that asked for assistance; a red patient without a
 * team; an assignment nobody has acknowledged after 5 minutes (gap A4); a
 * yellow/green patient waiting too long without a team (gap A6); and a
 * NEWS2 alert. Yellow/green patients still under their wait threshold stay in
 * the patient list with an "Ikke tildelt" badge; the panel only mentions how
 * many there are.
 */
import { useState } from 'react';
import {
  ATTENTION_WAIT_MINUTES,
  ASSIGNMENT_ACK_MINUTES,
  FIELD_TRIAGE_STYLE,
  TEAM_OPERATIONAL_STATUS_LABELS,
  minutesSince,
  type FieldTriageStatus,
} from '../../lib/constants';
import { formatRelativeAge } from '../../lib/observation';
import type { DeteriorationAlert, Team, TeamPatientEngagement } from '../../lib/types';
import {
  AmkNotifiedPill,
  assignmentAckState,
  fieldPatientName,
  type FieldPatient,
} from './PatientManagementPanel';
import { Button, Icon, Pill, PatientNumberPill } from '../../components/ui';
import { TeamAssistanceActions } from './TeamAssistanceActions';

interface AttentionQueuePanelProps {
  teams: Team[];
  patients: FieldPatient[];
  alerts: DeteriorationAlert[];
  onAssignTeam: (patientId: string, teamId: string) => Promise<void> | void;
  onDismissAlert: (patientId: string) => void;
  /** Stand a patrol down after its call for help is resolved (confirmed inline). */
  onClearTeamAssistance?: (teamId: string) => Promise<void> | void;
  /** Open the message compose addressed to this patrol. */
  onMessageTeam?: (teamId: string) => void;
  /** Assignment acknowledgement (gap A4) — who is en route / transporting whom. */
  teamPatientEngagements?: Record<string, TeamPatientEngagement[]>;
  now?: Date;
}

const CLOSED = new Set(['discharged', 'transferred']);

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

const groupHeadingStyle = { margin: '0 0 var(--space-2)' };

export function AttentionQueuePanel({
  teams,
  patients,
  alerts,
  onAssignTeam,
  onDismissAlert,
  onClearTeamAssistance,
  onMessageTeam,
  teamPatientEngagements = {},
  now = new Date(),
}: AttentionQueuePanelProps) {
  const [assigning, setAssigning] = useState<Record<string, boolean>>({});

  const needsAssistance = teams
    .filter((t) => t.operationalStatus === 'needs_assistance')
    .sort((a, b) => (a.statusUpdatedAt ?? '').localeCompare(b.statusUpdatedAt ?? ''));

  // A handed-over patient is in the tent now — it leaves every queue group
  // (gap A1 / item 8.22), same rule as the field team's workspace.
  const openUnassigned = patients.filter(
    (p) => !p.assignedTeamId && !CLOSED.has(p.status ?? '') && !p.handedOverAt,
  );
  // Only red patients belong in the banner regardless of age; oldest first.
  const unassigned = openUnassigned
    .filter((p) => p.triageStatus === 'red')
    .sort((a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime());

  // Yellow/green without a team, waiting past their threshold (gap A6 / item
  // 8.20) — "older than", so a patient exactly at the threshold stays quiet.
  const waitingTooLong = openUnassigned
    .filter((p) => {
      if (p.triageStatus !== 'yellow' && p.triageStatus !== 'green') return false;
      const minutes = minutesSince(p.updatedAt, now);
      if (minutes == null) return false;
      return minutes > ATTENTION_WAIT_MINUTES[p.triageStatus];
    })
    .sort((a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime());

  // Everyone else without a team just gets counted quietly — not yet over
  // their threshold (or untriaged, which has no threshold).
  const otherUnassignedCount = openUnassigned.length - unassigned.length - waitingTooLong.length;

  // Assigned but unacknowledged past the escalate threshold (gap A4 / item
  // 8.21) — the patrol has not gone en route or started transport.
  const unacknowledged = patients
    .filter((p) => p.assignedTeamId && !CLOSED.has(p.status ?? '') && !p.handedOverAt)
    .map((p) => ({ patient: p, ack: assignmentAckState(p, teamPatientEngagements[p.id] ?? [], now) }))
    .filter(({ ack }) => ack.kind === 'unconfirmed' && ack.minutes > ASSIGNMENT_ACK_MINUTES.escalate)
    .sort((a, b) => new Date(a.patient.updatedAt).getTime() - new Date(b.patient.updatedAt).getTime());

  const total = needsAssistance.length + unassigned.length + unacknowledged.length + waitingTooLong.length + alerts.length;
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
      className={`card${total > 0 ? ' card--critical' : ''}`}
      style={{ marginBottom: 'var(--space-4)', overflow: 'hidden' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-2)', padding: 'var(--space-3) var(--space-4)' }}>
        <h2
          id="attention-queue-title"
          style={{ margin: 0, fontSize: 'var(--text-lg)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 'var(--space-2)', color: total > 0 ? 'var(--color-status-critical)' : 'var(--color-text)' }}
        >
          {total > 0 ? <Icon name="alert" /> : <Icon name="check" />}
          Krever handling
        </h2>
        <Pill
          size="lg"
          data-testid="attention-queue-count"
          aria-live="polite"
          tone={total > 0
            ? { color: 'var(--color-status-critical)', bg: 'var(--color-status-critical-bg)' }
            : { color: 'var(--color-text-muted)', bg: 'var(--color-surface-sunken)' }}
        >
          {total === 0 ? 'Ingen ventende' : <><span className="data">{total}</span>&nbsp;{total === 1 ? 'oppgave' : 'oppgaver'}</>}
        </Pill>
      </div>

      {total === 0 ? (
        <p
          data-testid="attention-queue-empty"
          style={{ margin: 0, padding: '0 var(--space-4) var(--space-3)', fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}
        >
          Ingen røde pasienter uten lag, og ingen lag ber om bistand.
          {otherUnassignedCount > 0 && (
            <> <span className="data">{otherUnassignedCount}</span> {otherUnassignedCount === 1 ? 'pasient' : 'pasienter'} uten lag (gul/grønn) står i pasientlisten.</>
          )}
        </p>
      ) : (
        <div style={{ padding: '0 var(--space-3) var(--space-3)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {needsAssistance.length > 0 && (
            <div>
              <h3 className="section-label" style={groupHeadingStyle}>Lag som trenger bistand</h3>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                {needsAssistance.map((team) => (
                  <li key={team.id} data-testid={`attention-team-${team.id}`} style={{ ...rowStyle, borderLeft: '4px solid var(--color-status-critical)' }}>
                    <span style={{ fontWeight: 700, fontSize: 'var(--text-base)', color: 'var(--color-status-critical)' }}>
                      {team.name}
                    </span>
                    <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text)', flex: 1, minWidth: 120 }}>
                      {team.statusNote || TEAM_OPERATIONAL_STATUS_LABELS.needs_assistance}
                    </span>
                    {clock(team.statusUpdatedAt) && (
                      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        siden kl. <span className="data">{clock(team.statusUpdatedAt)}</span>
                        {team.contactRadio && <><Icon name="radio" size="sm" /><span className="data">{team.contactRadio}</span></>}
                        {team.contactPhone && <><Icon name="phone" size="sm" /><span className="data">{team.contactPhone}</span></>}
                      </span>
                    )}
                    <TeamAssistanceActions team={team} onClear={onClearTeamAssistance} onMessage={onMessageTeam} testIdPrefix="attention" />
                  </li>
                ))}
              </ul>
            </div>
          )}

          {unassigned.length > 0 && (
            <div>
              <h3 className="section-label" style={groupHeadingStyle}>Røde pasienter uten lag</h3>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                {unassigned.map((patient) => {
                  const triage = patient.triageStatus ? FIELD_TRIAGE_STYLE[patient.triageStatus as FieldTriageStatus] : null;
                  const where = patient.positionText
                    ?? (patient.lat != null && patient.lon != null ? `GPS ${patient.lat.toFixed(4)}, ${patient.lon.toFixed(4)}` : null);
                  return (
                    <li key={patient.id} data-testid={`attention-patient-${patient.id}`} style={{ ...rowStyle, borderLeft: '4px solid var(--color-triage-red)' }}>
                      <Pill tone={triage ? { color: triage.text, bg: triage.bg } : undefined}>
                        {triage?.label ?? 'Ikke triagert'}
                      </Pill>
                      <PatientNumberPill seq={patient.seq} data-testid={`patient-number-${patient.id}`} />
                      <span style={{ fontWeight: 700, fontSize: 'var(--text-base)', minWidth: 0 }}>
                        {fieldPatientName(patient)}
                      </span>
                      <AmkNotifiedPill patientId={patient.id} amkNotifiedAt={patient.amkNotifiedAt} />
                      <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', flex: 1, minWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {where ?? 'Posisjon ukjent'} · meldt {formatRelativeAge(patient.updatedAt, now)}
                      </span>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 'var(--text-sm)', fontWeight: 600 }}>
                        <span className="sr-only">Tildel lag til {fieldPatientName(patient)}</span>
                        <select
                          data-testid={`attention-assign-${patient.id}`}
                          className="field"
                          value=""
                          disabled={!!assigning[patient.id] || teams.length === 0}
                          onChange={(e) => void assign(patient.id, e.target.value)}
                          style={{
                            width: 'auto', minWidth: 180, minHeight: 44, padding: '0 var(--space-2)',
                            border: '1px solid var(--color-border-strong)', color: 'var(--color-text)',
                            fontSize: 'var(--text-sm)', fontWeight: 600, cursor: 'pointer',
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

          {unacknowledged.length > 0 && (
            <div>
              <h3 className="section-label" style={groupHeadingStyle}>Ikke bekreftet tildeling</h3>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                {unacknowledged.map(({ patient, ack }) => {
                  const triage = patient.triageStatus ? FIELD_TRIAGE_STYLE[patient.triageStatus as FieldTriageStatus] : null;
                  const minutes = ack.kind === 'unconfirmed' ? Math.floor(ack.minutes) : null;
                  return (
                    <li key={patient.id} data-testid={`attention-unacked-${patient.id}`} style={{ ...rowStyle, borderLeft: '4px solid var(--color-status-warning)' }}>
                      {triage && <Pill tone={{ color: triage.text, bg: triage.bg }}>{triage.label}</Pill>}
                      <PatientNumberPill seq={patient.seq} data-testid={`patient-number-${patient.id}`} />
                      <span style={{ fontWeight: 700, fontSize: 'var(--text-base)', minWidth: 0 }}>
                        {fieldPatientName(patient)}
                      </span>
                      <AmkNotifiedPill patientId={patient.id} amkNotifiedAt={patient.amkNotifiedAt} />
                      <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-status-warning)', fontWeight: 600, flex: 1, minWidth: 120 }}>
                        Ikke bekreftet · {minutes} min hos {teamName(patient.assignedTeamId) ?? 'lag'}
                      </span>
                      {onMessageTeam && patient.assignedTeamId && (
                        <Button
                          variant="secondary"
                          size="sm"
                          icon="chat"
                          data-testid={`attention-unacked-message-${patient.id}`}
                          onClick={() => onMessageTeam(patient.assignedTeamId!)}
                        >
                          Melding
                        </Button>
                      )}
                      <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 'var(--text-sm)', fontWeight: 600 }}>
                        <span className="sr-only">Tildel nytt lag til {fieldPatientName(patient)}</span>
                        <select
                          data-testid={`attention-assign-${patient.id}`}
                          className="field"
                          value=""
                          disabled={!!assigning[patient.id] || teams.length === 0}
                          onChange={(e) => void assign(patient.id, e.target.value)}
                          style={{
                            width: 'auto', minWidth: 180, minHeight: 44, padding: '0 var(--space-2)',
                            border: '1px solid var(--color-border-strong)', color: 'var(--color-text)',
                            fontSize: 'var(--text-sm)', fontWeight: 600, cursor: 'pointer',
                          }}
                        >
                          <option value="">{assigning[patient.id] ? 'Tildeler…' : 'Tildel på nytt…'}</option>
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

          {waitingTooLong.length > 0 && (
            <div>
              <h3 className="section-label" style={groupHeadingStyle}>Venter for lenge</h3>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                {waitingTooLong.map((patient) => {
                  const triage = patient.triageStatus ? FIELD_TRIAGE_STYLE[patient.triageStatus as FieldTriageStatus] : null;
                  const where = patient.positionText
                    ?? (patient.lat != null && patient.lon != null ? `GPS ${patient.lat.toFixed(4)}, ${patient.lon.toFixed(4)}` : null);
                  return (
                    <li key={patient.id} data-testid={`attention-waitlong-${patient.id}`} style={{ ...rowStyle, borderLeft: '4px solid var(--color-status-warning)' }}>
                      <Pill tone={triage ? { color: triage.text, bg: triage.bg } : undefined}>
                        {triage?.label ?? 'Ikke triagert'}
                      </Pill>
                      <PatientNumberPill seq={patient.seq} data-testid={`patient-number-${patient.id}`} />
                      <span style={{ fontWeight: 700, fontSize: 'var(--text-base)', minWidth: 0 }}>
                        {fieldPatientName(patient)}
                      </span>
                      <AmkNotifiedPill patientId={patient.id} amkNotifiedAt={patient.amkNotifiedAt} />
                      <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', flex: 1, minWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {where ?? 'Posisjon ukjent'} · venter {formatRelativeAge(patient.updatedAt, now)}
                      </span>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 'var(--text-sm)', fontWeight: 600 }}>
                        <span className="sr-only">Tildel lag til {fieldPatientName(patient)}</span>
                        <select
                          data-testid={`attention-assign-${patient.id}`}
                          className="field"
                          value=""
                          disabled={!!assigning[patient.id] || teams.length === 0}
                          onChange={(e) => void assign(patient.id, e.target.value)}
                          style={{
                            width: 'auto', minWidth: 180, minHeight: 44, padding: '0 var(--space-2)',
                            border: '1px solid var(--color-border-strong)', color: 'var(--color-text)',
                            fontSize: 'var(--text-sm)', fontWeight: 600, cursor: 'pointer',
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

          {otherUnassignedCount > 0 && (
            <p data-testid="attention-queue-other-unassigned" style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
              <span className="data">{otherUnassignedCount}</span> {otherUnassignedCount === 1 ? 'pasient' : 'pasienter'} uten lag (gul/grønn) står i pasientlisten.
            </p>
          )}

          {alerts.length > 0 && (
            <div>
              <h3 className="section-label" style={groupHeadingStyle}>NEWS2 stiger raskt</h3>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                {[...alerts].sort((a, b) => b.ratePerHour - a.ratePerHour).map((alert) => {
                  const patient = patients.find((p) => p.id === alert.patientId);
                  const label = patient ? fieldPatientName(patient) : `Pasient ${alert.patientId.slice(0, 8)}`;
                  const team = teamName(patient?.assignedTeamId);
                  return (
                    <li key={alert.patientId} data-testid={`attention-alert-${alert.patientId}`} style={{ ...rowStyle, borderLeft: '4px solid var(--color-status-critical)' }}>
                      <span style={{ fontWeight: 700, fontSize: 'var(--text-base)' }}>{label}</span>
                      <span
                        className="data"
                        style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--color-status-critical)' }}
                        aria-label={`NEWS2 stiger — score ${alert.news2Score}, pluss ${alert.ratePerHour.toFixed(1)} poeng per time`}
                      >
                        NEWS2 {alert.news2Score} · +{alert.ratePerHour.toFixed(1)}/t
                      </span>
                      <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', flex: 1 }}>
                        {team ? `Lag: ${team}` : patient ? 'Ikke tildelt lag' : ''}
                        {patient?.positionText ? ` · ${patient.positionText}` : ''}
                        {' · '}{formatRelativeAge(alert.receivedAt, now)}
                      </span>
                      <Button variant="secondary" size="sm" icon="check" onClick={() => onDismissAlert(alert.patientId)} aria-label={`Fjern varsel for ${label}`}>
                        Sett
                      </Button>
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
