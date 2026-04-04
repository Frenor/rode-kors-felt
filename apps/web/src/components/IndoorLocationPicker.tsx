import type { EventIndoorLayout } from '../lib/types';

type IndoorLocationMode = 'gps' | 'indoor_zone';

interface IndoorLocationPickerProps {
  layout: EventIndoorLayout;
  mode: IndoorLocationMode;
  floorId: string;
  zoneId: string;
  onModeChange: (mode: IndoorLocationMode) => void;
  onFloorChange: (floorId: string) => void;
  onZoneChange: (zoneId: string) => void;
}

export function IndoorLocationPicker({
  layout,
  mode,
  floorId,
  zoneId,
  onModeChange,
  onFloorChange,
  onZoneChange,
}: IndoorLocationPickerProps) {
  const selectedFloor = layout.floors.find((floor) => floor.id === floorId) ?? layout.floors[0];
  const zoneOptions = selectedFloor?.zones ?? [];
  const selectedZone = zoneOptions.find((zone) => zone.id === zoneId) ?? zoneOptions[0];

  return (
    <section
      aria-label="Innendørs lokasjon"
      style={{
        padding: 'var(--space-4)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)',
        background: 'var(--color-surface)',
        marginBottom: 'var(--space-4)',
      }}
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
        <button
          type="button"
          onClick={() => onModeChange('indoor_zone')}
          aria-pressed={mode === 'indoor_zone'}
          className="touch-target"
          style={{
            minHeight: 48,
            padding: '0 var(--space-3)',
            borderRadius: 'var(--radius-md)',
            border: `2px solid ${mode === 'indoor_zone' ? 'var(--color-brand)' : 'var(--color-border)'}`,
            background: mode === 'indoor_zone' ? 'var(--color-brand-dim)' : 'var(--color-surface)',
            color: 'var(--color-text)',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Innendørs lokasjon
        </button>
        <button
          type="button"
          onClick={() => onModeChange('gps')}
          aria-pressed={mode === 'gps'}
          className="touch-target"
          style={{
            minHeight: 48,
            padding: '0 var(--space-3)',
            borderRadius: 'var(--radius-md)',
            border: `2px solid ${mode === 'gps' ? 'var(--color-brand)' : 'var(--color-border)'}`,
            background: mode === 'gps' ? 'var(--color-brand-dim)' : 'var(--color-surface)',
            color: 'var(--color-text)',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          GPS-fallback
        </button>
      </div>

      {mode === 'indoor_zone' ? (
        <>
          <div style={{ display: 'grid', gap: 'var(--space-3)', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
            <div>
              <label
                htmlFor="indoor-floor"
                style={{
                  display: 'block',
                  marginBottom: 'var(--space-1)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 'var(--text-xs)',
                  color: 'var(--color-text-muted)',
                }}
              >
                Etasje
              </label>
              <select
                id="indoor-floor"
                value={selectedFloor?.id ?? ''}
                onChange={(e) => onFloorChange(e.target.value)}
                style={{
                  width: '100%',
                  minHeight: 'var(--touch-min)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-input-border)',
                  background: 'var(--color-input-bg)',
                  color: 'var(--color-text)',
                  padding: '0 var(--space-3)',
                  fontSize: 'var(--text-base)',
                }}
              >
                {layout.floors.map((floor) => (
                  <option key={floor.id} value={floor.id}>
                    {floor.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="indoor-zone"
                style={{
                  display: 'block',
                  marginBottom: 'var(--space-1)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 'var(--text-xs)',
                  color: 'var(--color-text-muted)',
                }}
              >
                Sone
              </label>
              <select
                id="indoor-zone"
                value={selectedZone?.id ?? ''}
                onChange={(e) => onZoneChange(e.target.value)}
                style={{
                  width: '100%',
                  minHeight: 'var(--touch-min)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-input-border)',
                  background: 'var(--color-input-bg)',
                  color: 'var(--color-text)',
                  padding: '0 var(--space-3)',
                  fontSize: 'var(--text-base)',
                }}
              >
                {zoneOptions.map((zone) => (
                  <option key={zone.id} value={zone.id}>
                    {zone.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div
            style={{
              marginTop: 'var(--space-3)',
              padding: 'var(--space-3)',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--color-surface-sunken)',
              color: 'var(--color-text-subtle)',
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--text-xs)',
            }}
          >
            Valgt lokasjon: {selectedFloor?.label ?? 'Ukjent etasje'} / {selectedZone?.label ?? 'Ukjent sone'}
          </div>
        </>
      ) : (
        <div
          style={{
            padding: 'var(--space-3)',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--color-surface-sunken)',
            color: 'var(--color-text-subtle)',
            fontSize: 'var(--text-sm)',
          }}
        >
          GPS brukes som fallback. Når posisjonen er klar, sendes lat/lng sammen med hendelsen.
        </div>
      )}
    </section>
  );
}
