import { useState } from 'react';
import type { SickbayIncomingItem } from '../../lib/types';

interface IncomingCriticalPanelProps {
  items: SickbayIncomingItem[];
  onStartTreatment: (patientId: string) => void;
  onAssignPlacement: (patientId: string, placementType: 'chair' | 'bed' | '', placementNumber: string) => void;
}

const reasonLabels: Record<string, string> = {
  needs_assistance: 'Trenger bistand',
  triage_red: 'Triage rød',
  news2_high: 'NEWS2 høy',
};

const triageLabels: Record<string, string> = {
  red: 'Rød',
  yellow: 'Gul',
  green: 'Grønn',
  black: 'Svart',
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
      style={{
        marginBottom: 'var(--space-4)',
        padding: 'var(--space-3)',
        borderRadius: 'var(--radius-md)',
        border: '2px solid var(--color-status-critical-border)',
        background: 'var(--color-status-critical-bg)',
      }}
    >
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-2)' }}>
        <h2 style={{ margin: 0, fontSize: 'var(--text-base)', color: 'var(--color-status-critical)' }}>
          Kritisk innkommende nå
        </h2>
        <span
          data-testid="sickbay-critical-count"
          style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--color-status-critical)' }}
        >
          {items.length} pasient{items.length === 1 ? '' : 'er'}
        </span>
      </header>

      <div style={{ marginTop: 'var(--space-2)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        {sortedItems.map((item) => (
          <article
            key={item.patientId}
            data-testid={`sickbay-critical-patient-${item.patientId}`}
            style={{
              padding: 'var(--space-2)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--color-status-critical-border)',
              background: 'var(--color-surface)',
              display: 'flex',
              justifyContent: 'space-between',
              gap: 'var(--space-2)',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ fontWeight: 700, fontSize: 'var(--text-sm)' }}>
                {item.label ?? `Pasient ${item.patientId.slice(0, 8)}`}
              </div>
              <div
                aria-label="Triage og NEWS2"
                style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)', color: 'var(--color-text-subtle)' }}
              >
                {item.triageStatus ? `Triage ${triageLabels[item.triageStatus] ?? item.triageStatus}` : ''}
                {item.news2 ? ` · NEWS2 ${item.news2.total}` : ''}
              </div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-subtle)' }}>
                {item.criticalReasons.map((reason) => reasonLabels[reason] ?? reason).join(' · ')}
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--color-text-subtle)' }}>
                {item.latestVitals
                  ? [
                      item.latestVitals.pulse != null ? `Puls ${item.latestVitals.pulse}` : null,
                      item.latestVitals.spo2 != null ? `SpO₂ ${item.latestVitals.spo2}` : null,
                      item.latestVitals.respiratoryRate != null ? `RF ${item.latestVitals.respiratoryRate}` : null,
                    ].filter(Boolean).join(' · ')
                  : 'Vitalia ikke registrert ennå'}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', alignItems: 'stretch' }}>
              <button
                onClick={() => onStartTreatment(item.patientId)}
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
                data-testid={`assign-placement-toggle-${item.patientId}`}
                onClick={() => togglePlacementRow(item.patientId)}
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

              {expandedPlacementRows[item.patientId] && (
                <div
                  data-testid={`assign-placement-form-${item.patientId}`}
                  style={{
                    display: 'grid',
                    gap: 'var(--space-2)',
                    minWidth: 220,
                  }}
                >
                  <select
                    value={placementFormByPatient[item.patientId]?.placementType ?? ''}
                    onChange={(e) => updatePlacementForm(item.patientId, {
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
                    value={placementFormByPatient[item.patientId]?.placementNumber ?? ''}
                    onChange={(e) => updatePlacementForm(item.patientId, {
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
                      const placementType = placementFormByPatient[item.patientId]?.placementType ?? '';
                      const placementNumber = placementFormByPatient[item.patientId]?.placementNumber ?? '';
                      onAssignPlacement(item.patientId, placementType, placementNumber);
                      setExpandedPlacementRows((prev) => ({ ...prev, [item.patientId]: false }));
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
          </article>
        ))}
      </div>
    </section>
  );
}
