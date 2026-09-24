import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { calculateNEWS2 } from '@rkf/shared-types';
import { api } from '../lib/api';
import { useAuthStore } from '../stores/auth';
import type { PatientJournal } from '../lib/types';
import { patientNumber } from '../lib/patient-number';
import {
  FIELD_TRIAGE_STYLE,
  formatPatientAge,
  formatSickbayPlacement,
  GENDER_LABELS,
  PATIENT_CLOSE_REASONS,
  routeLabels,
  statusLabels,
  TRANSPORT_NEED_LABELS,
} from '../lib/constants';
import { Button } from '../components/ui';

function formatClock(iso?: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' });
}

function formatDateTime(iso?: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('nb-NO', { dateStyle: 'short', timeStyle: 'short' });
}

/**
 * Printable patient journal (gap B7 / item 8.32) — `GET /patients/:id/journal`
 * rendered as a clean, print-friendly page: identity, vitals timeline with
 * NEWS2, notes, medications, AMK log, hand-over/transport/outcome. Fails
 * loud on a fetch error (CLAUDE.md "fail loud, never fake") — no placeholder
 * journal is ever shown in its place.
 */
export function PatientJournalPage() {
  const { patientId } = useParams<{ patientId: string }>();
  const navigate = useNavigate();
  const eventName = useAuthStore((s) => s.eventName);

  const [journal, setJournal] = useState<PatientJournal | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!patientId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    api.getPatientJournal(patientId)
      .then((res) => {
        if (!cancelled) setJournal(res);
      })
      .catch((err) => {
        console.error('[journal] Failed to load patient journal', err);
        if (!cancelled) setError(err instanceof Error ? err.message : 'Kunne ikke laste journal');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [patientId]);

  if (loading) {
    return (
      <div className="journal-page">
        <p style={{ color: 'var(--color-text-subtle)' }}>Laster journal…</p>
      </div>
    );
  }

  if (error || !journal) {
    return (
      <div className="journal-page">
        <div
          role="alert"
          style={{
            padding: 'var(--space-4)', borderRadius: 'var(--radius-md)',
            background: 'var(--color-status-critical-bg)', color: 'var(--color-status-critical)',
            fontWeight: 600,
          }}
        >
          {error ?? 'Fant ikke journal for denne pasienten.'}
        </div>
        <Button variant="secondary" size="lg" onClick={() => navigate(-1)} style={{ marginTop: 'var(--space-4)' }}>
          Tilbake
        </Button>
      </div>
    );
  }

  const { patient, vitalsHistory, notes, medications, amkCallLogs, teams } = journal;
  const numberLabel = patientNumber(patient) ?? 'Ukjent';
  const patientName = patient.fullName ?? patient.label ?? 'Ukjent pasient';
  const ageLabel = formatPatientAge({ birthDate: patient.birthDate ?? null, ageGroup: patient.ageGroup ?? null, ageYears: patient.ageYears ?? null });
  const genderLabel = patient.gender ? GENDER_LABELS[patient.gender] : null;
  const triage = patient.triageStatus ? FIELD_TRIAGE_STYLE[patient.triageStatus] : null;
  const placementLabel = formatSickbayPlacement(patient.placementType ?? null, patient.placementNumber ?? null);
  const handoverTeamName = patient.handedOverByTeamId ? teams.find((t) => t.id === patient.handedOverByTeamId)?.name ?? null : null;
  const transportTeamName = patient.transportTeamId ? teams.find((t) => t.id === patient.transportTeamId)?.name ?? null : null;
  const outcomeLabel = patient.fieldOutcome ? PATIENT_CLOSE_REASONS.find((r) => r.id === patient.fieldOutcome)?.label ?? patient.fieldOutcome : null;

  const sortedVitals = [...vitalsHistory].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  const sortedNotes = [...notes].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const sortedMeds = [...medications].sort((a, b) => new Date(b.givenAt).getTime() - new Date(a.givenAt).getTime());
  const sortedAmkLogs = [...amkCallLogs].sort((a, b) => new Date(b.calledAt).getTime() - new Date(a.calledAt).getTime());

  return (
    <div className="journal-page" style={{ maxWidth: 860, margin: '0 auto' }}>
      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
        <Button variant="ghost" size="md" icon="chevronRight" style={{ transform: 'scaleX(-1)' }} onClick={() => navigate(-1)}>
          Tilbake
        </Button>
        <Button variant="secondary" size="md" icon="printer" onClick={() => window.print()}>
          Skriv ut
        </Button>
      </div>

      <header style={{ marginBottom: 'var(--space-5)', borderBottom: '2px solid var(--color-border)', paddingBottom: 'var(--space-3)' }}>
        {eventName && (
          <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', fontWeight: 600 }}>{eventName}</p>
        )}
        <h1 style={{ fontSize: 'var(--text-xl)', fontWeight: 700, margin: '2px 0' }}>
          Pasient <span className="data">{numberLabel}</span> — {patientName}
        </h1>
        <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
          {[ageLabel, genderLabel, triage?.label ? `Triage: ${triage.label}` : null].filter(Boolean).join(' · ')}
        </p>
        <p style={{ margin: '4px 0 0', fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
          {statusLabels[patient.status] ?? patient.status}
          {placementLabel ? ` · ${placementLabel}` : ''}
          {patient.presentingComplaint ? ` · ${patient.presentingComplaint}` : ''}
        </p>
      </header>

      {/* Hand-over / transport / outcome lines */}
      <section style={{ marginBottom: 'var(--space-5)' }}>
        <h2 style={{ fontSize: 'var(--text-sm)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 'var(--space-2)' }}>
          Status og forløp
        </h2>
        <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4, fontSize: 'var(--text-sm)' }}>
          {patient.handedOverAt && (
            <li>Overlevert{handoverTeamName ? ` av ${handoverTeamName}` : ''} kl. {formatClock(patient.handedOverAt)}</li>
          )}
          {patient.transportNeed && (
            <li>
              Transport: {TRANSPORT_NEED_LABELS[patient.transportNeed]}
              {patient.transportPickupText ? ` — ${patient.transportPickupText}` : ''}
              {patient.transportRequestedAt ? ` · bedt om kl. ${formatClock(patient.transportRequestedAt)}` : ''}
              {transportTeamName ? ` · ${transportTeamName} tildelt kl. ${formatClock(patient.transportAssignedAt)}` : ''}
            </li>
          )}
          {patient.amkNotifiedAt && (
            <li>AMK varslet kl. {formatClock(patient.amkNotifiedAt)}{patient.amkNotifiedBy ? ` av ${patient.amkNotifiedBy}` : ''}</li>
          )}
          {outcomeLabel && <li>Utfall: {outcomeLabel}</li>}
          {!patient.handedOverAt && !patient.transportNeed && !patient.amkNotifiedAt && !outcomeLabel && (
            <li style={{ color: 'var(--color-text-subtle)' }}>Ingen overlevering, transport eller AMK-varsling registrert.</li>
          )}
        </ul>
      </section>

      {/* Vitals timeline with NEWS2 */}
      <section style={{ marginBottom: 'var(--space-5)' }}>
        <h2 style={{ fontSize: 'var(--text-sm)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 'var(--space-2)' }}>
          Vitale tegn
        </h2>
        {sortedVitals.length === 0 ? (
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-subtle)' }}>Ingen vitale tegn registrert.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)', textAlign: 'left' }}>
                <th style={{ padding: '4px 6px' }}>Kl.</th>
                <th style={{ padding: '4px 6px' }}>RF</th>
                <th style={{ padding: '4px 6px' }}>SpO₂</th>
                <th style={{ padding: '4px 6px' }}>BT</th>
                <th style={{ padding: '4px 6px' }}>Puls</th>
                <th style={{ padding: '4px 6px' }}>Temp</th>
                <th style={{ padding: '4px 6px' }}>ACVPU</th>
                <th style={{ padding: '4px 6px' }}>NEWS2</th>
              </tr>
            </thead>
            <tbody>
              {sortedVitals.map((v, i) => {
                const news2 = calculateNEWS2(v);
                return (
                  <tr key={v.id ?? i} data-testid="journal-vitals-row" style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td className="data" style={{ padding: '4px 6px' }}>{formatClock(v.timestamp)}</td>
                    <td className="data" style={{ padding: '4px 6px' }}>{v.respiratoryRate ?? '—'}</td>
                    <td className="data" style={{ padding: '4px 6px' }}>{v.spo2 ?? '—'}</td>
                    <td className="data" style={{ padding: '4px 6px' }}>{v.systolicBP ?? '—'}</td>
                    <td className="data" style={{ padding: '4px 6px' }}>{v.pulse ?? '—'}</td>
                    <td className="data" style={{ padding: '4px 6px' }}>{v.temperature ?? '—'}</td>
                    <td className="data" style={{ padding: '4px 6px' }}>{v.acvpu ?? '—'}</td>
                    <td className="data" style={{ padding: '4px 6px', fontWeight: 700 }}>{news2.total}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      {/* Notes */}
      <section style={{ marginBottom: 'var(--space-5)' }}>
        <h2 style={{ fontSize: 'var(--text-sm)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 'var(--space-2)' }}>
          Notater
        </h2>
        {sortedNotes.length === 0 ? (
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-subtle)' }}>Ingen notater.</p>
        ) : (
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {sortedNotes.map((n) => (
              <li key={n.id} style={{ fontSize: 'var(--text-sm)' }}>
                <span className="data" style={{ color: 'var(--color-text-subtle)' }}>{formatClock(n.createdAt)}</span>
                {' · '}
                <strong>{n.author}</strong>: {n.text}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Medications */}
      <section style={{ marginBottom: 'var(--space-5)' }}>
        <h2 style={{ fontSize: 'var(--text-sm)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 'var(--space-2)' }}>
          Medikamenter
        </h2>
        {sortedMeds.length === 0 ? (
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-subtle)' }}>Ingen medikamenter registrert.</p>
        ) : (
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {sortedMeds.map((m) => (
              <li key={m.id} style={{ fontSize: 'var(--text-sm)' }}>
                <span className="data" style={{ color: 'var(--color-text-subtle)' }}>{formatClock(m.givenAt)}</span>
                {' · '}
                {m.drug}{m.dose ? ` ${m.dose}` : ''}{m.route ? ` (${routeLabels[m.route] ?? m.route})` : ''}
                {m.givenBy ? ` — ${m.givenBy}` : ''}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* AMK call logs */}
      <section style={{ marginBottom: 'var(--space-5)' }}>
        <h2 style={{ fontSize: 'var(--text-sm)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 'var(--space-2)' }}>
          AMK-logg
        </h2>
        {sortedAmkLogs.length === 0 ? (
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-subtle)' }}>Ingen AMK-kontakt registrert.</p>
        ) : (
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {sortedAmkLogs.map((log) => (
              <li key={log.id} style={{ fontSize: 'var(--text-sm)' }}>
                <span className="data" style={{ color: 'var(--color-text-subtle)' }}>{formatClock(log.calledAt)}</span>
                {' — '}{log.summaryGiven}
                <br />
                <span style={{ color: 'var(--color-text-muted)' }}>
                  Råd: {log.amkGuidance}
                  {log.referenceId ? ` · Ref ${log.referenceId}` : ''}
                  {log.eta ? ` · ETA ${log.eta}` : ''}
                  {log.followUpOwner ? ` · Ansvar: ${log.followUpOwner}` : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <footer style={{ marginTop: 'var(--space-6)', paddingTop: 'var(--space-2)', borderTop: '1px solid var(--color-border)', fontSize: 'var(--text-xs)', color: 'var(--color-text-subtle)' }}>
        Generert {formatDateTime(new Date().toISOString())}
      </footer>
    </div>
  );
}
