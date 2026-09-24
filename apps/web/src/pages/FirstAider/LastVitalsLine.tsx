import { calculateNEWS2 } from '@rkf/shared-types';
import { news2Colors } from '../../lib/constants';
import type { VitalsReading } from '../../lib/types';
import { Pill } from '../../components/ui';

const LEVEL_LABELS = { routine: 'rutine', low: 'lav', medium: 'middels', high: 'høy' } as const;

const clock = (iso: string) =>
  new Date(iso).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' });

/** "Puls 96 · SpO₂ 94 % · RF 20 · BT 158 · Temp 37.2 · A" — only what was recorded. */
export function summarizeVitals(v: VitalsReading): string {
  return [
    v.pulse != null ? `Puls ${v.pulse}` : null,
    v.spo2 != null ? `SpO₂ ${v.spo2} %` : null,
    v.respiratoryRate != null ? `RF ${v.respiratoryRate}` : null,
    v.systolicBP != null ? `BT ${v.systolicBP}` : null,
    v.temperature != null ? `Temp ${v.temperature}` : null,
    v.acvpu ? `ACVPU ${v.acvpu.charAt(0).toUpperCase()}` : null,
  ].filter(Boolean).join(' · ');
}

/** Small NEWS2 pill for a collapsed patient row. */
export function News2Pill({ vitals }: { vitals: VitalsReading }) {
  const n2 = calculateNEWS2(vitals);
  const tone = news2Colors[n2.alertLevel];
  return (
    <Pill aria-label={`NEWS2 ${n2.total}, ${LEVEL_LABELS[n2.alertLevel]}`} tone={{ color: tone.color, bg: tone.bg }}>
      <span className="data">NEWS2 {n2.total}</span>
    </Pill>
  );
}

/**
 * The last set a patrol recorded for this patient, with the NEWS2 it implies.
 * Without it the numbers vanished the moment "Lagre" was tapped (review F13).
 */
export function LastVitalsLine({ patientId, vitals }: { patientId: string; vitals: VitalsReading }) {
  const n2 = calculateNEWS2(vitals);
  const tone = news2Colors[n2.alertLevel];
  return (
    <div
      data-testid={`firstaid-last-vitals-${patientId}`}
      style={{
        display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'var(--space-2)',
        marginBottom: 'var(--space-2)', fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)',
      }}
    >
      <span>Sist kl. <span className="data" style={{ color: 'var(--color-text)' }}>{clock(vitals.timestamp)}</span></span>
      <span className="data" style={{ color: 'var(--color-text)' }}>{summarizeVitals(vitals)}</span>
      <Pill tone={{ color: tone.color, bg: tone.bg }}>
        <span className="data">NEWS2 {n2.total}</span>&nbsp;· {LEVEL_LABELS[n2.alertLevel]}
      </Pill>
    </div>
  );
}
