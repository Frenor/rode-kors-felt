/**
 * StatsGrid — event counters with a neutral change indicator.
 *
 * The arrow only says "this number moved since the last refresh"; it is
 * deliberately not coloured green/red, because more patients is not good and
 * fewer incoming is not bad.
 */

import { useState, useEffect, useRef } from 'react';

/** Minimal shape needed to compute sick bay occupancy — a subset of FieldPatient. */
interface OccupancyPatient {
  status?: string | null;
  placementType?: 'chair' | 'bed' | null;
}

interface StatsGridProps {
  stats: Record<string, number> | null;
  lastUpdatedAt?: number;
  prevStats?: Record<string, number> | null;
  /** Capacity settings (gap B6 / item 8.30) — `event.settings.sickbay`, undefined/null when not set. */
  sickbaySettings?: { chairs?: number; beds?: number } | null;
  /** Open patients, to count how many chairs/beds are actually occupied. */
  patients?: OccupancyPatient[];
}

const CLOSED_STATUSES = new Set(['discharged', 'transferred']);

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
          className={`data${pop ? ' animate-count-pop' : ''}`}
          style={{ fontSize: 'var(--text-2xl)', fontWeight: 700 }}
        >
          {value ?? 0}
        </div>
        {trend && (
          <span
            aria-label={trend === '↑' ? 'økt siden forrige oppdatering' : 'redusert siden forrige oppdatering'}
            style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', fontWeight: 700 }}
          >
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

/**
 * "Sykestue" tile (gap B6 / item 8.30) — chairs/beds occupied out of the
 * event's configured capacity. Never invents a capacity: without settings it
 * says so instead of showing a made-up number.
 */
function SickbayTile({ sickbaySettings, patients }: { sickbaySettings?: { chairs?: number; beds?: number } | null; patients: OccupancyPatient[] }) {
  const chairsCapacity = sickbaySettings?.chairs;
  const bedsCapacity = sickbaySettings?.beds;
  const hasCapacity = chairsCapacity != null || bedsCapacity != null;

  const open = patients.filter((p) => !CLOSED_STATUSES.has(p.status ?? ''));
  const chairsOccupied = open.filter((p) => p.placementType === 'chair').length;
  const bedsOccupied = open.filter((p) => p.placementType === 'bed').length;

  return (
    <div
      data-testid="stats-sickbay-tile"
      style={{
        padding: 'var(--space-3) var(--space-4)', borderRadius: 'var(--radius-md)',
        border: '1px solid var(--color-border)', background: 'var(--color-surface)',
      }}
    >
      {hasCapacity ? (
        <>
          <div className="data" style={{ fontSize: 'var(--text-2xl)', fontWeight: 700 }}>
            {chairsOccupied}/{chairsCapacity ?? '—'}
          </div>
          <div className="section-label">Sykestue — stoler</div>
          {bedsCapacity != null && (
            <div className="data" style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginTop: 2 }}>
              {bedsOccupied}/{bedsCapacity} senger
            </div>
          )}
        </>
      ) : (
        <>
          <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text-subtle)' }}>
            Kapasitet ikke satt
          </div>
          <div className="section-label">Sykestue</div>
        </>
      )}
    </div>
  );
}

export function StatsGrid({ stats, lastUpdatedAt, prevStats, sickbaySettings, patients = [] }: StatsGridProps) {
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
      <div className="stats-grid">
        {STAT_ENTRIES.map(({ key, label }) => (
          <StatCard
            key={key}
            label={label}
            value={stats[key] ?? 0}
            prevValue={prevStats?.[key]}
          />
        ))}
        <SickbayTile sickbaySettings={sickbaySettings} patients={patients} />
      </div>
      {secondsAgo !== null && (
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-subtle)', marginTop: 'var(--space-1)', marginBottom: 0 }}>
          Oppdatert <span className="data">{secondsAgo}</span> s siden
        </p>
      )}
    </div>
  );
}
