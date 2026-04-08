/**
 * StatsGrid — displays event statistics with trend indicators and filter on double-click.
 */

import { useState, useEffect, useRef } from 'react';

interface StatsGridProps {
  stats: Record<string, number> | null;
  lastUpdatedAt?: number;
  prevStats?: Record<string, number> | null;
  onFilter?: (key: string) => void;
}

const STAT_ENTRIES: { key: string; label: string }[] = [
  { key: 'totalIncidents',      label: 'Totalt' },
  { key: 'activeIncidents',     label: 'Aktive' },
  { key: 'resolvedIncidents',   label: 'Løste' },
  { key: 'totalPatients',       label: 'Pasienter' },
  { key: 'patientsInTreatment', label: 'I behandling' },
  { key: 'discharged',          label: 'Utskrevet' },
];

function StatCard({
  label,
  value,
  prevValue,
  onFilter,
  statKey,
}: {
  label: string;
  value: number;
  prevValue?: number;
  onFilter?: (key: string) => void;
  statKey: string;
}) {
  const prevRef = useRef<number | undefined>(prevValue);
  const [pop, setPop] = useState(false);

  useEffect(() => {
    if (prevRef.current !== undefined && prevRef.current !== value) {
      setPop(true);
      const t = setTimeout(() => setPop(false), 400);
      prevRef.current = value;
      return () => clearTimeout(t);
    }
    prevRef.current = value;
  }, [value]);

  const trend =
    prevValue !== undefined && prevValue !== value
      ? value > prevValue
        ? '↑'
        : '↓'
      : null;
  const trendColor =
    trend === '↑'
      ? 'var(--color-status-ok)'
      : trend === '↓'
      ? 'var(--color-status-critical)'
      : undefined;

  return (
    <div
      onDoubleClick={() => onFilter?.(statKey)}
      title={onFilter ? 'Dobbeltklikk for å filtrere' : undefined}
      className="card-p4"
      style={{ cursor: onFilter ? 'pointer' : undefined }}
    >
      <div className="flex-align gap-1">
        <div
          className={`mono fw-700 text-3xl${pop ? ' animate-count-pop' : ''}`}
        >
          {value ?? 0}
        </div>
        {trend && (
          <span className="mono-sm fw-700" style={{ color: trendColor }}>
            {trend}
          </span>
        )}
      </div>
      <div className="section-label">
        {label}
      </div>
    </div>
  );
}

export function StatsGrid({ stats, lastUpdatedAt, prevStats, onFilter }: StatsGridProps) {
  const [secondsAgo, setSecondsAgo] = useState<number | null>(null);

  useEffect(() => {
    if (!lastUpdatedAt) { setSecondsAgo(null); return; }
    const update = () => setSecondsAgo(Math.floor((Date.now() - lastUpdatedAt) / 1000));
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [lastUpdatedAt]);

  if (!stats) return null;

  return (
    <div className="mb-6">
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
        gap: 'var(--space-3)',
      }}>
        {STAT_ENTRIES.map(({ key, label }) => (
          <StatCard
            key={key}
            statKey={key}
            label={label}
            value={stats[key] ?? 0}
            prevValue={prevStats?.[key]}
            onFilter={onFilter}
          />
        ))}
      </div>
      {secondsAgo !== null && (
        <p className="mono-xs-subtle mt-1" style={{ marginBottom: 0 }}>
          Oppdatert {secondsAgo}s siden
        </p>
      )}
    </div>
  );
}
