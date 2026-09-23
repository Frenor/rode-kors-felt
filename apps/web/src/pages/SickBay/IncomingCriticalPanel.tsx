import { useState } from 'react';
import type { SickbayIncomingItem } from '../../lib/types';
import { FIELD_TRIAGE_STYLE, type FieldTriageStatus } from '../../lib/constants';
import { Button, Icon, Pill } from '../../components/ui';

interface IncomingCriticalPanelProps {
  items: SickbayIncomingItem[];
  onStartTreatment: (patientId: string) => void;
  onAssignPlacement: (patientId: string, placementType: 'chair' | 'bed' | '', placementNumber: string) => void;
}

/** Why the patient is in this panel — phrased as a reason, not a repeat of the badge line. */
const reasonLabels: Record<string, string> = {
  needs_assistance: 'Laget har bedt om bistand',
  triage_red: 'Rød triage fra felt',
  news2_high: 'NEWS2 høy — kontinuerlig overvåkning',
};

export function IncomingCriticalPanel({ items, onStartTreatment, onAssignPlacement }: IncomingCriticalPanelProps) {
  const [expandedPlacementRows, setExpandedPlacementRows] = useState<Record<string, boolean>>({});
  const [placementFormByPatient, setPlacementFormByPatient] = useState<Record<string, {
    placementType: 'chair' | 'bed' | '';
    placementNumber: string;
  }>>({});
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
      role="alert"
      aria-live="assertive"
      className="card card--critical"
      style={{
        marginBottom: 'var(--space-4)',
        padding: 'var(--space-3)',
        background: 'var(--color-status-critical-bg)',
      }}
    >
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-2)' }}>
        <h2 style={{ margin: 0, fontSize: 'var(--text-base)', color: 'var(--color-status-critical)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
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
                  {triage && <Pill tone={{ color: triage.text, bg: triage.bg }}>{triage.label}</Pill>}
                  <span style={{ fontWeight: 700, fontSize: 'var(--text-base)' }}>
                    {item.label ?? `Pasient ${item.patientId.slice(0, 8)}`}
                  </span>
                  {item.news2 && (
                    <span className="data" aria-label="NEWS2" style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--color-status-critical)' }}>
                      NEWS2 {item.news2.total}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text)', fontWeight: 600 }}>
                  {item.criticalReasons.map((reason) => reasonLabels[reason] ?? reason).join(' · ')}
                </div>
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
                <Button variant="primary" size="lg" icon="play" onClick={() => onStartTreatment(item.patientId)}>
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
