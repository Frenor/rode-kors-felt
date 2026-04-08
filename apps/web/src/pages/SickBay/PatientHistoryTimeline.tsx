import { calculateNEWS2 } from '@rkf/shared-types';
import { amkCriticalityLabel, news2Colors, routeLabels } from '../../lib/constants';
import type { ActionHistoryEntry, SickBayPatient, MedicationRecord } from '../../lib/types';

interface PatientHistoryTimelineProps {
  patient: SickBayPatient;
  medications: MedicationRecord[];
}

export function PatientHistoryTimeline({ patient, medications }: PatientHistoryTimelineProps) {
  const vitalsEntries = (patient.vitalsHistory ?? []).map((v) => ({
    type: 'vitals' as const, time: v.timestamp, data: v,
  }));
  const noteEntries = (patient.notes ?? []).map((n) => ({
    type: 'note' as const, time: n.createdAt, data: n,
  }));
  const medEntries = medications.map((m) => ({
    type: 'medication' as const, time: m.givenAt, data: m,
  }));
  const artifactEntries = (patient.actionHistory ?? [])
    .filter((action) =>
      action.actionType === 'patient.amk_call_logged'
      || action.actionType === 'patient.amk_ai_draft_generated'
      || action.actionType === 'patient.amk_ai_script_confirmed',
    )
    .map((action) => ({
      type: 'artifact' as const,
      time: action.createdAt,
      data: action,
    }));

  const timeline = [...vitalsEntries, ...noteEntries, ...medEntries, ...artifactEntries]
    .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

  return (
    <div className="panel-sunken">
      <h4 className="heading-sm">
        Logg / Historikk
      </h4>

      {timeline.length === 0 ? (
        <p className="text-xs-subtle">
          Ingen historikk ennå.
        </p>
      ) : timeline.map((entry, i) => {
        const timeStr = new Date(entry.time).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' });

        if (entry.type === 'vitals') {
          const v = entry.data;
          const n2 = calculateNEWS2(v);
          const n2c = news2Colors[n2.alertLevel];
          return (
            <div key={i} className="timeline-row">
              <span className="timeline-ts">{timeStr}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', fontWeight: 700, padding: '1px 6px', borderRadius: 'var(--radius-full)', background: n2c.bg, color: n2c.color, whiteSpace: 'nowrap' }}>
                NEWS2 {n2.total}
              </span>
              <span className="mono-xs-subtle" style={{ flexWrap: 'wrap' }}>
                {[
                  v.pulse && `Puls ${v.pulse}`,
                  v.spo2 && `SpO₂ ${v.spo2}%`,
                  v.respiratoryRate && `RF ${v.respiratoryRate}`,
                  v.systolicBP && `BT ${v.systolicBP}`,
                  v.temperature && `Temp ${v.temperature}°C`,
                  v.acvpu && `ACVPU ${v.acvpu}`,
                  v.painScore != null && `Smerte ${v.painScore}/10`,
                ].filter(Boolean).join(' · ')}
              </span>
            </div>
          );
        }

        if (entry.type === 'note') {
          return (
            <div key={i} className="timeline-row">
              <span className="timeline-ts">{timeStr}</span>
              <div className="flex-1">
                {entry.data.author && (
                  <span className="text-xs-subtle fw-600" style={{ marginBottom: 2, display: 'block' }}>
                    {entry.data.author}
                  </span>
                )}
                <span className="text-xs" style={{ color: 'var(--color-text)', whiteSpace: 'pre-wrap' }}>
                  {entry.data.text}
                </span>
              </div>
            </div>
          );
        }

        if (entry.type === 'medication') {
          return (
            <div key={i} className="timeline-row" style={{ alignItems: 'center' }}>
              <span className="timeline-ts">{timeStr}</span>
              <span className="mono-xs fw-700" style={{ color: 'var(--color-status-warning)' }}>Rx</span>
              <span className="mono-xs" style={{ color: 'var(--color-text)' }}>
                {entry.data.drug}{entry.data.dose && ` ${entry.data.dose}`}
                {entry.data.route && ` (${routeLabels[entry.data.route] ?? entry.data.route})`}
                {entry.data.givenBy && ` — ${entry.data.givenBy}`}
              </span>
            </div>
          );
        }

        if (entry.type === 'artifact') {
          const action = entry.data as ActionHistoryEntry;
          const callLog = (action.payload as { callLog?: Record<string, unknown> }).callLog;
          const draft = (action.payload as { draft?: Record<string, unknown> }).draft;
          const confirmed = (action.payload as { confirmed?: Record<string, unknown> }).confirmed;

          const label =
            action.actionType === 'patient.amk_call_logged'
              ? 'AMK'
              : action.actionType === 'patient.amk_ai_draft_generated'
                ? 'AI-forslag'
                : 'AI-bekreftelse';

          const detail = action.actionType === 'patient.amk_call_logged'
            ? [
                callLog?.summaryGiven,
                callLog?.amkGuidance,
                callLog?.referenceId ? `Ref ${callLog.referenceId}` : null,
                callLog?.eta ? `ETA ${callLog.eta}` : null,
                callLog?.followUpOwner ? `Ansvar: ${callLog.followUpOwner}` : null,
              ].filter(Boolean).join(' · ')
            : action.actionType === 'patient.amk_ai_draft_generated'
              ? [
                  typeof draft?.criticality === 'string'
                    ? `Kritikalitet ${amkCriticalityLabel(draft.criticality)}`
                    : null,
                  draft?.rationale ? String(draft.rationale) : null,
                ].filter(Boolean).join(' · ')
              : [
                  typeof confirmed?.criticality === 'string'
                    ? `Kritikalitet ${amkCriticalityLabel(confirmed.criticality)}`
                    : null,
                  confirmed?.spokenScript ? String(confirmed.spokenScript) : null,
                ].filter(Boolean).join(' · ');

          return (
            <div key={i} className="timeline-row">
              <span className="timeline-ts">{timeStr}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', fontWeight: 700, padding: '1px 6px', borderRadius: 'var(--radius-full)', background: 'var(--color-brand-dim)', color: 'var(--color-brand)', whiteSpace: 'nowrap' }}>
                {label}
              </span>
              <span className="mono-xs" style={{ color: 'var(--color-text)', whiteSpace: 'pre-wrap' }}>
                {detail || 'Ingen detaljer registrert.'}
              </span>
            </div>
          );
        }

        return null;
      })}
    </div>
  );
}
