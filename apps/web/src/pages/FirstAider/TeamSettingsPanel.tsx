/**
 * TeamSettingsPanel
 *
 * Collapsible panel showing transport mode, gear checklist, and contact info
 * for the selected team. All state management lives in the parent
 * (FirstAiderDashboard); this component is purely presentational + callbacks.
 */
import type { TeamTransport } from '../../stores/auth';

export const GEAR_CATALOG = [
  { id: 'first_aid_bag',     label: 'Førstehjelpsveske' },
  { id: 'aed',               label: 'Hjertestarter (AED)' },
  { id: 'stretcher',         label: 'Båre' },
  { id: 'oxygen',            label: 'Oksygen' },
  { id: 'emergency_blanket', label: 'Varmedekke' },
  { id: 'tourniquet',        label: 'Tourniquet' },
  { id: 'vacuum_mattress',   label: 'Vakuummadrass' },
  { id: 'spine_board',       label: 'Ryggbrett' },
  { id: 'cervical_collar',   label: 'Nakkekrage' },
] as const;

export const TRANSPORT_LABELS: Record<TeamTransport, string> = {
  foot: 'Til fots',
  bike: 'Sykkel',
  vehicle: 'Kjøretøy',
  atv: 'ATV',
};

export interface TeamSettingsPanelProps {
  currentTransport: TeamTransport;
  onTransportChange: (transport: TeamTransport) => void;
  teamGear: string[];
  showGear: boolean;
  onToggleGear: () => void;
  onGearToggle: (itemId: string) => void;
  contactPhone: string;
  contactRadio: string;
  contactsDirty: boolean;
  showContacts: boolean;
  onToggleContacts: () => void;
  onContactPhoneChange: (value: string) => void;
  onContactRadioChange: (value: string) => void;
  onContactsSave: () => void;
}

export function TeamSettingsPanel({
  currentTransport,
  onTransportChange,
  teamGear,
  showGear,
  onToggleGear,
  onGearToggle,
  contactPhone,
  contactRadio,
  contactsDirty,
  showContacts,
  onToggleContacts,
  onContactPhoneChange,
  onContactRadioChange,
  onContactsSave,
}: TeamSettingsPanelProps) {
  return (
    <section
      aria-label="Lagets innstillinger"
      className="card card-p4 flex-col gap-4"
    >
      {/* Transport type */}
      <div>
        <div className="text-xs-subtle mb-1">
          Fremkomstmiddel
        </div>
        <div
          role="radiogroup"
          aria-label="Velg fremkomstmiddel"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 'var(--space-1)',
          }}
        >
          {(Object.keys(TRANSPORT_LABELS) as TeamTransport[]).map((t) => (
            <button
              key={t}
              onClick={() => onTransportChange(t)}
              aria-pressed={currentTransport === t}
              className="touch-target"
              style={{
                minHeight: 44,
                padding: 'var(--space-1)',
                borderRadius: 'var(--radius-sm)',
                border: `1px solid ${currentTransport === t ? 'var(--color-brand)' : 'var(--color-border)'}`,
                background: currentTransport === t ? 'var(--color-brand-dim)' : 'transparent',
                color: 'var(--color-text)',
                fontSize: 'var(--text-xs)',
                fontWeight: currentTransport === t ? 700 : 400,
                cursor: 'pointer',
              }}
            >
              {TRANSPORT_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      {/* Gear checklist */}
      <div>
        <button
          onClick={onToggleGear}
          className="flex-between"
          style={{ width: '100%', padding: 'var(--space-2) 0', background: 'none', border: 'none', color: 'var(--color-text)', cursor: 'pointer' }}
        >
          <span className="text-xs-subtle">
            Utstyr ({teamGear.length}/{GEAR_CATALOG.length})
          </span>
          <span className="text-xs-subtle">
            {showGear ? '▲' : '▼'}
          </span>
        </button>
        {showGear && (
          <div
            role="group"
            aria-label="Utstyrsliste"
            className="flex-col gap-1"
          >
            {GEAR_CATALOG.map((item) => {
              const checked = teamGear.includes(item.id);
              return (
                <label
                  key={item.id}
                  className="flex flex-align gap-2"
                  style={{
                    padding: 'var(--space-2) var(--space-3)',
                    borderRadius: 'var(--radius-sm)',
                    border: `1px solid ${checked ? 'var(--color-brand)' : 'var(--color-border)'}`,
                    background: checked ? 'var(--color-brand-dim)' : 'transparent',
                    cursor: 'pointer',
                    minHeight: 44,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onGearToggle(item.id)}
                    className="flex-shrink-0"
                    style={{ width: 18, height: 18, accentColor: 'var(--color-brand)' }}
                  />
                  <span
                    style={{ fontSize: 'var(--text-sm)', fontWeight: checked ? 600 : 400 }}
                  >
                    {item.label}
                  </span>
                </label>
              );
            })}
          </div>
        )}
      </div>

      {/* Contact numbers */}
      <div>
        <button
          onClick={onToggleContacts}
          className="flex-between"
          style={{ width: '100%', padding: 'var(--space-2) 0', background: 'none', border: 'none', color: 'var(--color-text)', cursor: 'pointer' }}
        >
          <span className="text-xs-subtle">
            Kontaktinfo{' '}
            {contactPhone || contactRadio
              ? `· ${[contactPhone, contactRadio].filter(Boolean).join(' / ')}`
              : '· Ikke satt'}
          </span>
          <span className="text-xs-subtle">
            {showContacts ? '▲' : '▼'}
          </span>
        </button>
        {showContacts && (
          <div className="flex-col gap-2">
            <div>
              <label
                htmlFor="contact-phone"
                className="field-label"
              >
                Mobilnummer
              </label>
              <input
                id="contact-phone"
                type="tel"
                value={contactPhone}
                onChange={(e) => onContactPhoneChange(e.target.value)}
                placeholder="f.eks. 900 12 345"
                className="w-full form-input-sm"
                style={{ height: 44, boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label
                htmlFor="contact-radio"
                className="field-label"
              >
                ISSI
              </label>
              <input
                id="contact-radio"
                type="text"
                inputMode="numeric"
                value={contactRadio}
                onChange={(e) => onContactRadioChange(e.target.value)}
                placeholder="f.eks. 1234567"
                className="w-full form-input-sm"
                style={{ height: 44, boxSizing: 'border-box' }}
              />
            </div>
            <button
              onClick={onContactsSave}
              disabled={!contactsDirty}
              className="touch-target"
              style={{
                height: 44,
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                background: contactsDirty ? 'var(--color-brand)' : 'var(--color-border)',
                color: contactsDirty ? 'white' : 'var(--color-text-subtle)',
                fontSize: 'var(--text-sm)',
                fontWeight: 600,
                cursor: contactsDirty ? 'pointer' : 'default',
              }}
            >
              Lagre kontaktinfo
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
