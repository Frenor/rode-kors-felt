/**
 * StatsGrid — event counters with a neutral change indicator.
 *
 * The arrow only says "this number moved since the last refresh"; it is
 * deliberately not coloured green/red, because more patients is not good and
 * fewer incoming is not bad.
 */

import { useState, useEffect, useRef } from 'react';

interface StatsGridProps {
  stats: Record<string, number> | null;
  lastUpdatedAt?: number;
  prevStats?: Record<string, number> | null;
}

const STAT_ENTRIES: { key: string; label: string }[] = [
  { key: 'totalPatients',       label: 'Pasienter totalt' },
  { key: 'patientsIncoming',    label: 'Innkommende' },
  { key: 'patientsInTreatment', label: 'I behandling' },
  { key: 'patientsObservation', label: 'Observasjon' },
  { key: 'transferred',         label: 'Overført' },
  { key: 'discharged',          label: 'Utskrevet' },
];

function StatCard({ label, value, prevValue }: { label: string; value: number; prevValue?: number }) {
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

  return (
    <div
      style={{
        padding: 'var(--space-3) var(--space-4)', borderRadius: 'var(--radius-md)',
        border: '1px solid var(--color-border)', background: 'var(--color-surface)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-1)' }}>
        <div
          className={pop ? 'animate-count-pop' : undefined}
          style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-2xl)', fontWeight: 700 }}
        >
          {value ?? 0}
        </div>
        {trend && (
          <span
            aria-label={trend === '↑' ? 'økt siden forrige oppdatering' : 'redusert siden forrige oppdatering'}
            style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', fontWeight: 700 }}
          >
            {trend}
          </span>
        )}
      </div>
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)',
        color: 'var(--color-text-muted)', textTransform: 'uppercase',
      }}>
        {label}
      </div>
    </div>
  );
}

export function StatsGrid({ stats, lastUpdatedAt, prevStats }: StatsGridProps) {
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
    <div style={{ marginBottom: 'var(--space-4)' }}>
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
        gap: 'var(--space-2)',
      }}>
        {STAT_ENTRIES.map(({ key, label }) => (
          <StatCard
            key={key}
            label={label}
            value={stats[key] ?? 0}
            prevValue={prevStats?.[key]}
          />
        ))}
      </div>
      {secondsAgo !== null && (
        <p style={{
          fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)',
          color: 'var(--color-text-subtle)', marginTop: 'var(--space-1)', marginBottom: 0,
        }}>
          Oppdatert {secondsAgo}s siden
        </p>
      )}
    </div>
  );
}
