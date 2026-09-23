/**
 * TransportRequestSheet
 *
 * Bottom sheet for requesting patient transport (gap B3 / item 8.26). Same
 * pattern as TeamStatusPickerSheet: a fixed backdrop, a sheet sliding up from
 * the bottom, dismissible by tapping the backdrop. Three 56 px chips pick
 * what the patient needs to be moved (Båre / ATV / Ambulanse); the pickup
 * text is prefilled with whatever position the patrol already has for this
 * patient, so it only has to be corrected, not retyped.
 */
import { useState } from 'react';
import type { TransportNeed } from '../../lib/types';
import { TRANSPORT_NEED_LABELS } from '../../lib/constants';
import { Button } from '../../components/ui';

const TRANSPORT_NEED_ORDER: TransportNeed[] = ['stretcher', 'atv', 'ambulance'];

export interface TransportRequestSheetProps {
  /** Prefills the pickup text — normally the patient's known position text. */
  initialPickupText: string;
  onSend: (need: TransportNeed, pickupText: string) => void;
  onClose: () => void;
}

export function TransportRequestSheet({ initialPickupText, onSend, onClose }: TransportRequestSheetProps) {
  const [need, setNeed] = useState<TransportNeed | null>(null);
  const [pickupText, setPickupText] = useState(initialPickupText);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Be om transport"
      data-testid="firstaid-transport-sheet"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 'var(--z-modal)',
        background: 'rgba(0,0,0,0.55)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--color-surface)',
          borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0',
          padding: 'var(--space-4) var(--space-4) calc(var(--space-4) + env(safe-area-inset-bottom, 0px))',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-3)',
        }}
      >
        <div style={{ fontWeight: 700, fontSize: 'var(--text-lg)' }}>Be om transport</div>

        <div
          role="radiogroup"
          aria-label="Hva trenger pasienten"
          style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-2)' }}
        >
          {TRANSPORT_NEED_ORDER.map((value) => {
            const active = need === value;
            return (
              <Button
                key={value}
                variant="tone"
                tone={{ color: 'var(--color-status-info)', bg: 'var(--color-status-info-bg)' }}
                size="lg"
                role="radio"
                aria-checked={active}
                icon={active ? 'check' : undefined}
                data-testid={`firstaid-transport-need-${value}`}
                onClick={() => setNeed(value)}
                style={{ padding: 0, minHeight: 56 }}
              >
                {TRANSPORT_NEED_LABELS[value]}
              </Button>
            );
          })}
        </div>

        <div>
          <label htmlFor="transport-pickup-text" className="section-label" style={{ display: 'block', marginBottom: 'var(--space-2)' }}>
            Hentested
          </label>
          <input
            id="transport-pickup-text"
            className="field"
            value={pickupText}
            onChange={(e) => setPickupText(e.target.value)}
            placeholder="f.eks. Sektor B, ved drikkestasjon 3"
          />
        </div>

        <Button
          variant="primary"
          size="lg"
          block
          disabled={!need}
          data-testid="firstaid-transport-sheet-send"
          onClick={() => { if (need) onSend(need, pickupText.trim()); }}
        >
          Send
        </Button>
        <Button variant="ghost" size="lg" block onClick={onClose}>
          Avbryt
        </Button>
      </div>
    </div>
  );
}
