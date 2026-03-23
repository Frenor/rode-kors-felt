import { calculateNEWS2 } from '@rkf/shared-types';
import { news2Colors, routeLabels } from '../../lib/constants';
import type { SickBayPatient, MedicationRecord } from '../../lib/types';

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

  const timeline = [...vitalsEntries, ...noteEntries, ...medEntries]
    .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

  return (
    <div style={{
      marginTop: 'var(--space-3)', padding: 'var(--space-3)',
      background: 'var(--color-surface-sunken)', borderRadius: 'var(--radius-md)',
    }}>
      <h4 style={{ fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 'var(--space-2)' }}>
        Logg / Historikk
      </h4>

      {timeline.length === 0 ? (
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-subtle)' }}>
          Ingen historikk ennå.
        </p>
      ) : timeline.map((entry, i) => {
        const timeStr = new Date(entry.time).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' });

        if (entry.type === 'vitals') {
          const v = entry.data;
          const n2 = calculateNEWS2(v);
          const n2c = news2Colors[n2.alertLevel];
          return (
            <div key={i} style={{
              display: 'flex', gap: 'var(--space-2)', alignItems: 'flex-start',
              padding: 'var(--space-2) 0', borderBottom: '1px solid var(--color-border)',
            }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--color-text-subtle)', whiteSpace: 'nowrap', minWidth: 38 }}>{timeStr}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', fontWeight: 700, padding: '1px 6px', borderRadius: 'var(--radius-full)', background: n2c.bg, color: n2c.color, whiteSpace: 'nowrap' }}>
                NEWS2 {n2.total}
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--color-text-subtle)', flexWrap: 'wrap' }}>
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
            <div key={i} style={{
              display: 'flex', gap: 'var(--space-2)', alignItems: 'flex-start',
              padding: 'var(--space-2) 0', borderBottom: '1px solid var(--color-border)',
            }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--color-text-subtle)', whiteSpace: 'nowrap', minWidth: 38 }}>{timeStr}</span>
              <div style={{ flex: 1 }}>
                {entry.data.author && (
                  <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--color-text-subtle)', marginBottom: 2, display: 'block' }}>
                    {entry.data.author}
                  </span>
                )}
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text)', whiteSpace: 'pre-wrap' }}>
                  {entry.data.text}
                </span>
              </div>
            </div>
          );
        }

        if (entry.type === 'medication') {
          return (
            <div key={i} style={{
              display: 'flex', gap: 'var(--space-2)', alignItems: 'center',
              padding: 'var(--space-2) 0', borderBottom: '1px solid var(--color-border)',
            }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--color-text-subtle)', whiteSpace: 'nowrap', minWidth: 38 }}>{timeStr}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--color-status-warning)' }}>Rx</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--color-text)' }}>
                {entry.data.drug}{entry.data.dose && ` ${entry.data.dose}`}
                {entry.data.route && ` (${routeLabels[entry.data.route] ?? entry.data.route})`}
                {entry.data.givenBy && ` — ${entry.data.givenBy}`}
              </span>
            </div>
          );
        }

        return null;
      })}
    </div>
  );
}
