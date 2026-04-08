import { useState } from 'react';
import type { SickbayIncomingItem } from '../../lib/types';

interface IncomingCriticalPanelProps {
  items: SickbayIncomingItem[];
  onStartTreatment: (patientId: string) => void;
  onAssignPlacement: (patientId: string, placementType: 'chair' | 'bed' | '', placementNumber: string) => void;
}

const reasonLabels: Record<string, string> = {
  needs_assistance: 'Trenger bistand',
  open_escalation: 'Aktiv eskalering',
  triage_immediate: 'START umiddelbar',
  news2_high: 'NEWS2 høy',
};

const progressLabels: Record<string, string> = {
  dispatched: 'Utsendt',
  on_scene: 'På stedet',
  transporting: 'Under transport',
  at_sickbay: 'Ved sykestue',
};

const triageLabels: Record<string, string> = {
  immediate: 'Umiddelbar',
  delayed: 'Utsatt',
  minor: 'Mindre',
  expectant: 'Forventet',
};

export function IncomingCriticalPanel({ items, onStartTreatment, onAssignPlacement }: IncomingCriticalPanelProps) {
  const [expandedPlacementRows, setExpandedPlacementRows] = useState<Record<string, boolean>>({});
  const [placementFormByIncident, setPlacementFormByIncident] = useState<Record<string, {
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

  const togglePlacementRow = (incidentId: string) => {
    setExpandedPlacementRows((prev) => ({ ...prev, [incidentId]: !prev[incidentId] }));
  };

  const updatePlacementForm = (
    incidentId: string,
    patch: Partial<{ placementType: 'chair' | 'bed' | ''; placementNumber: string }>,
  ) => {
    setPlacementFormByIncident((prev) => ({
      ...prev,
      [incidentId]: {
        placementType: prev[incidentId]?.placementType ?? '',
        placementNumber: prev[incidentId]?.placementNumber ?? '',
        ...patch,
      },
    }));
  };

  return (
    <section
      data-testid="sickbay-critical-banner"
      role="alert"
      aria-live="assertive"
      style={{
        marginBottom: 'var(--space-4)',
        padding: 'var(--space-3)',
        borderRadius: 'var(--radius-md)',
        border: '2px solid var(--color-status-critical-border)',
        background: 'var(--color-status-critical-bg)',
      }}
    >
      <header className="flex-between gap-2">
        <h2 className="text-base text-critical" style={{ margin: 0 }}>
          Kritisk innkommende nå
        </h2>
        <span
          data-testid="sickbay-critical-count"
          className="mono-xs text-critical"
        >
          {items.length} pasient{items.length === 1 ? '' : 'er'}
        </span>
      </header>

      <div className="flex-col gap-2 mt-2">
        {sortedItems.map((item) => (
          <article
            key={item.incidentId}
            data-testid={`sickbay-critical-patient-${item.incidentId}`}
            className="card flex-between gap-2"
            style={{
              padding: 'var(--space-2)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--color-status-critical-border)',
            }}
          >
            <div className="flex-col" style={{ gap: 4 }}>
              <div className="text-sm fw-700">
                Hendelse {item.incidentId.slice(0, 8)}
              </div>
              <div
                aria-label="Progresjon i forløpet"
                className="mono-xs-subtle"
              >
                Forløp: {progressLabels[item.progressStage] ?? item.progressStage}
                {item.triageTag ? ` · START ${triageLabels[item.triageTag] ?? item.triageTag}` : ''}
                {item.news2 ? ` · NEWS2 ${item.news2.total}` : ''}
              </div>
              <div className="text-xs-subtle">
                {item.criticalReasons.map((reason) => reasonLabels[reason] ?? reason).join(' · ')}
              </div>
              <div className="mono-xs-subtle">
                {item.latestVitals
                  ? [
                      item.latestVitals.pulse != null ? `Puls ${item.latestVitals.pulse}` : null,
                      item.latestVitals.spo2 != null ? `SpO₂ ${item.latestVitals.spo2}` : null,
                      item.latestVitals.respiratoryRate != null ? `RF ${item.latestVitals.respiratoryRate}` : null,
                    ].filter(Boolean).join(' · ')
                  : 'Vitalia ikke registrert ennå'}
              </div>
            </div>
            {item.patientId ? (
              <div className="flex-col gap-2" style={{ alignItems: 'stretch' }}>
                <button
                  onClick={() => onStartTreatment(item.patientId!)}
                  className="touch-target"
                  style={{
                    minHeight: 'var(--touch-min)',
                    padding: '0 var(--space-3)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--color-status-critical)',
                    background: 'var(--color-status-critical)',
                    color: 'white',
                    fontSize: 'var(--text-xs)',
                    fontWeight: 700,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Start behandling
                </button>

                <button
                  type="button"
                  className="touch-target"
                  data-testid={`assign-placement-toggle-${item.incidentId}`}
                  onClick={() => togglePlacementRow(item.incidentId)}
                  style={{
                    minHeight: 'var(--touch-min)',
                    padding: '0 var(--space-3)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--color-border)',
                    background: 'transparent',
                    color: 'var(--color-text)',
                    fontSize: 'var(--text-xs)',
                    fontWeight: 700,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Tildel stol/seng
                </button>

                {expandedPlacementRows[item.incidentId] && (
                  <div
                    data-testid={`assign-placement-form-${item.incidentId}`}
                    className="gap-2"
                    style={{ display: 'grid', minWidth: 220 }}
                  >
                    <select
                      value={placementFormByIncident[item.incidentId]?.placementType ?? ''}
                      onChange={(e) => updatePlacementForm(item.incidentId, {
                        placementType: e.target.value as 'chair' | 'bed' | '',
                      })}
                      style={{
                        height: 'var(--touch-min)',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--color-input-border)',
                        background: 'var(--color-input-bg)',
                        color: 'var(--color-text)',
                        padding: '0 var(--space-2)',
                      }}
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
                      value={placementFormByIncident[item.incidentId]?.placementNumber ?? ''}
                      onChange={(e) => updatePlacementForm(item.incidentId, {
                        placementNumber: e.target.value.replace(/[^0-9]/g, '').slice(0, 4),
                      })}
                      style={{
                        height: 'var(--touch-min)',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--color-input-border)',
                        background: 'var(--color-input-bg)',
                        color: 'var(--color-text)',
                        padding: '0 var(--space-2)',
                      }}
                    />
                    <button
                      type="button"
                      className="touch-target"
                      onClick={() => {
                        const placementType = placementFormByIncident[item.incidentId]?.placementType ?? '';
                        const placementNumber = placementFormByIncident[item.incidentId]?.placementNumber ?? '';
                        onAssignPlacement(item.patientId!, placementType, placementNumber);
                        setExpandedPlacementRows((prev) => ({ ...prev, [item.incidentId]: false }));
                      }}
                      style={{
                        minHeight: 'var(--touch-min)',
                        borderRadius: 'var(--radius-sm)',
                        border: 'none',
                        background: 'var(--color-brand)',
                        color: '#fff',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      Lagre plassering
                    </button>
                  </div>
                )}
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}
