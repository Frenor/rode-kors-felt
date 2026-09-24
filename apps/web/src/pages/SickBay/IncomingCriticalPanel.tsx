import { useEffect, useRef, useState } from 'react';
import type { SickbayIncomingItem, TeamPatientEngagement } from '../../lib/types';
import { FIELD_TRIAGE_STYLE, type FieldTriageStatus } from '../../lib/constants';
import { Button, Icon, PatientNumberPill, Pill } from '../../components/ui';
import { FieldEngagementLine } from './FieldEngagementLine';

function formatClockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' });
}

interface IncomingCriticalPanelProps {
  items: SickbayIncomingItem[];
  /** Patrol engagements by patient id — who is bringing the patient in. */
  engagements?: Record<string, TeamPatientEngagement[]>;
  onStartTreatment: (patientId: string) => void;
  onAssignPlacement: (patientId: string, placementType: 'chair' | 'bed' | '', placementNumber: string) => void;
}

/** Why the patient is in this panel — phrased as a reason, not a repeat of the badge line. */
const reasonLabels: Record<string, string> = {
  needs_assistance: 'Laget har bedt om bistand',
  triage_red: 'Rød triage fra felt',
  news2_high: 'NEWS2 høy — kontinuerlig overvåkning',
};

export function IncomingCriticalPanel({ items, engagements = {}, onStartTreatment, onAssignPlacement }: IncomingCriticalPanelProps) {
  const [expandedPlacementRows, setExpandedPlacementRows] = useState<Record<string, boolean>>({});
  const [placementFormByPatient, setPlacementFormByPatient] = useState<Record<string, {
    placementType: 'chair' | 'bed' | '';
    placementNumber: string;
  }>>({});

  // Screen readers hear a new critical patient once, when it arrives — not the
  // whole panel again on every refetch (review S8). The first render seeds the
  // seen set silently; announcing everything already on screen is noise.
  const seenIds = useRef<Set<string> | null>(null);
  const [announcement, setAnnouncement] = useState('');
  useEffect(() => {
    if (seenIds.current === null) {
      seenIds.current = new Set(items.map((item) => item.patientId));
      return;
    }
    const fresh = items.filter((item) => !seenIds.current!.has(item.patientId));
    for (const item of items) seenIds.current.add(item.patientId);
    if (fresh.length > 0) {
      const names = fresh.map((item) => item.label ?? `Pasient ${item.patientId.slice(0, 8)}`).join(', ');
      setAnnouncement(`Ny kritisk innkommende: ${names}`);
    }
  }, [items]);

  if (items.length === 0) return null;

  const sortedItems = [...items].sort((a, b) => {
    const aNews = a.news2?.alertLevel === 'high' ? 0 : a.news2?.alertLevel === 'medium' ? 1 : 2;
    const bNews = b.news2?.alertLevel === 'high' ? 0 : b.news2?.alertLevel === 'medium' ? 1 : 2;
    if (aNews !== bNews) return aNews - bNews;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });

  const togglePlacementRow = (patientId: string) => {
    setExpandedPlacementRows((prev) => ({ ...prev, [patientId]: !prev[patientId] }));
  };

  const updatePlacementForm = (
    patientId: string,
    patch: Partial<{ placementType: 'chair' | 'bed' | ''; placementNumber: string }>,
  ) => {
    setPlacementFormByPatient((prev) => ({
      ...prev,
      [patientId]: {
        placementType: prev[patientId]?.placementType ?? '',
        placementNumber: prev[patientId]?.placementNumber ?? '',
        ...patch,
      },
    }));
  };

  return (
    <section
      data-testid="sickbay-critical-banner"
      aria-labelledby="sickbay-critical-title"
      className="card card--critical"
      style={{
        marginBottom: 'var(--space-4)',
        padding: 'var(--space-3)',
      }}
    >
      <div className="sr-only" role="status" aria-live="assertive" data-testid="sickbay-critical-announcer">
        {announcement}
      </div>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-2)' }}>
        <h2 id="sickbay-critical-title" style={{ margin: 0, fontSize: 'var(--text-base)', color: 'var(--color-status-critical)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <Icon name="alert" />
          Kritisk innkommende nå
        </h2>
        <span
          data-testid="sickbay-critical-count"
          style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--color-status-critical)' }}
        >
          <span className="data">{items.length}</span> pasient{items.length === 1 ? '' : 'er'}
        </span>
      </header>

      <div style={{ marginTop: 'var(--space-2)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        {sortedItems.map((item) => {
          const triage = item.triageStatus ? FIELD_TRIAGE_STYLE[item.triageStatus as FieldTriageStatus] : null;
          return (
            <article
              key={item.patientId}
              data-testid={`sickbay-critical-patient-${item.patientId}`}
              className="card card--stripe"
              style={{
                '--stripe': triage?.text ?? 'var(--color-status-critical)',
                padding: 'var(--space-3)',
                display: 'flex',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 'var(--space-3)',
              } as React.CSSProperties}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: '1 1 220px', minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                  <PatientNumberPill seq={item.seq} data-testid={`patient-number-${item.patientId}`} />
                  {triage && <Pill tone={{ color: triage.text, bg: triage.bg }}>{triage.label}</Pill>}
                  <span style={{ fontWeight: 700, fontSize: 'var(--text-base)' }}>
                    {item.label ?? `Pasient ${item.patientId.slice(0, 8)}`}
                  </span>
                  {item.news2 && (
                    <span className="data" aria-label="NEWS2" style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--color-status-critical)' }}>
                      NEWS2 {item.news2.total}
                    </span>
                  )}
                  {item.amkNotifiedAt && (
                    <Pill
                      data-testid={`amk-notified-pill-${item.patientId}`}
                      tone={{ color: 'var(--color-status-critical)', bg: 'transparent', border: 'transparent' }}
                    >
                      AMK varslet kl. {formatClockTime(item.amkNotifiedAt)}
                    </Pill>
                  )}
                </div>
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text)', fontWeight: 600 }}>
                  {item.criticalReasons.map((reason) => reasonLabels[reason] ?? reason).join(' · ')}
                </div>
                <FieldEngagementLine patientId={item.patientId} engagements={engagements[item.patientId] ?? []} />
                <div className="data" style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
                  {item.latestVitals
                    ? [
                        item.latestVitals.pulse != null ? `Puls ${item.latestVitals.pulse}` : null,
                        item.latestVitals.spo2 != null ? `SpO₂ ${item.latestVitals.spo2}` : null,
                        item.latestVitals.respiratoryRate != null ? `RF ${item.latestVitals.respiratoryRate}` : null,
                      ].filter(Boolean).join(' · ')
                    : 'Vitalia ikke registrert ennå'}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', alignItems: 'stretch', flex: '0 1 220px' }}>
                <Button variant="ink" size="lg" icon="play" onClick={() => onStartTreatment(item.patientId)}>
                  Start behandling
                </Button>

                <Button
                  variant="secondary"
                  icon="bed"
                  data-testid={`assign-placement-toggle-${item.patientId}`}
                  aria-expanded={!!expandedPlacementRows[item.patientId]}
                  onClick={() => togglePlacementRow(item.patientId)}
                >
                  Tildel stol/seng
                </Button>

                {expandedPlacementRows[item.patientId] && (
                  <div
                    data-testid={`assign-placement-form-${item.patientId}`}
                    style={{ display: 'grid', gap: 'var(--space-2)' }}
                  >
                    <select
                      className="field"
                      aria-label="Plasseringstype"
                      value={placementFormByPatient[item.patientId]?.placementType ?? ''}
                      onChange={(e) => updatePlacementForm(item.patientId, {
                        placementType: e.target.value as 'chair' | 'bed' | '',
                      })}
                    >
                      <option value="">Velg type</option>
                      <option value="chair">Stol</option>
                      <option value="bed">Seng</option>
                    </select>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      placeholder="Nummer"
                      aria-label="Plasseringsnummer"
                      className="field field--data"
                      value={placementFormByPatient[item.patientId]?.placementNumber ?? ''}
                      onChange={(e) => updatePlacementForm(item.patientId, {
                        placementNumber: e.target.value.replace(/[^0-9]/g, '').slice(0, 4),
                      })}
                    />
                    <Button
                      variant="secondary"
                      onClick={() => {
                        const placementType = placementFormByPatient[item.patientId]?.placementType ?? '';
                        const placementNumber = placementFormByPatient[item.patientId]?.placementNumber ?? '';
                        onAssignPlacement(item.patientId, placementType, placementNumber);
                        setExpandedPlacementRows((prev) => ({ ...prev, [item.patientId]: false }));
                      }}
                    >
                      Lagre plassering
                    </Button>
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
