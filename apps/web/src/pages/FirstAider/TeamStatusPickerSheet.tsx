/**
 * TeamStatusPickerSheet
 *
 * Bottom-sheet modal for selecting a team's operational status.
 * "Trenger bistand" is the safety-critical option and is rendered as a
 * separate large red button above the four routine states so it cannot be
 * confused with them in the dark. Picking it opens a second step — "Hva
 * trenger dere?" (gap A3) — instead of sending immediately, so the
 * coordinator does not have to radio back and ask what. Clicking the
 * backdrop dismisses the sheet from either step.
 */
import { useState } from 'react';
import { TEAM_OPERATIONAL_STATUS_LABELS, TEAM_OPERATIONAL_STATUS_STYLE } from '../../lib/constants';
import type { TeamOperationalStatus } from '../../lib/types';
import { Button, Icon } from '../../components/ui';
import { AssistanceReasonStep } from './AssistanceReasonStep';

const ROUTINE_STATUSES: TeamOperationalStatus[] = ['available', 'en_route', 'on_scene', 'unavailable'];

export interface TeamStatusPickerSheetProps {
  currentStatus: TeamOperationalStatus;
  onSelect: (status: TeamOperationalStatus, note?: string) => Promise<void>;
  onClose: () => void;
}

export function TeamStatusPickerSheet({
  currentStatus,
  onSelect,
  onClose,
}: TeamStatusPickerSheetProps) {
  const [step, setStep] = useState<'status' | 'assist-reason'>('status');
  const pick = async (status: TeamOperationalStatus, note?: string) => {
    await onSelect(status, note);
    onClose();
  };
  const isNeedsAssistance = currentStatus === 'needs_assistance';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Velg lagstatus"
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
          gap: 'var(--space-2)',
        }}
      >
        {step === 'status' ? (
          <>
            <div style={{ fontWeight: 700, fontSize: 'var(--text-lg)', marginBottom: 'var(--space-1)' }}>
              Lagstatus
            </div>

            <div
              role="radiogroup"
              aria-label="Lagstatus i felt"
              data-testid="firstaid-field-status-controls"
              style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}
            >
              <Button
                variant={isNeedsAssistance ? 'danger' : 'danger-soft'}
                size="xl"
                block
                role="radio"
                aria-checked={isNeedsAssistance}
                data-testid="firstaid-field-status-needs_assistance"
                onClick={() => setStep('assist-reason')}
                style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 2, padding: 'var(--space-3) var(--space-4)', textAlign: 'left' }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <Icon name={isNeedsAssistance ? 'check' : 'alert'} size="lg" />
                  {TEAM_OPERATIONAL_STATUS_LABELS.needs_assistance}
                </span>
                <span style={{ fontSize: 'var(--text-sm)', fontWeight: 500, opacity: 0.9 }}>
                  Varsler koordinator og sykestue umiddelbart
                </span>
              </Button>

              {ROUTINE_STATUSES.map((status) => {
                const style = TEAM_OPERATIONAL_STATUS_STYLE[status];
                const selected = currentStatus === status;
                return (
                  <Button
                    key={status}
                    variant="tone"
                    tone={{ color: style.color, bg: style.bg }}
                    size="lg"
                    block
                    role="radio"
                    aria-checked={selected}
                    data-testid={`firstaid-field-status-${status}`}
                    onClick={() => pick(status)}
                    style={{ justifyContent: 'flex-start', color: selected ? style.color : 'var(--color-text)', borderColor: selected ? style.color : 'var(--color-border)' }}
                  >
                    <span aria-hidden="true" style={{ width: 14, height: 14, borderRadius: '50%', background: style.color, flexShrink: 0 }} />
                    {TEAM_OPERATIONAL_STATUS_LABELS[status]}
                    {selected && <Icon name="check" style={{ marginLeft: 'auto', color: style.color }} />}
                  </Button>
                );
              })}
            </div>

            <Button variant="ghost" size="lg" block onClick={onClose} style={{ marginTop: 'var(--space-2)', background: 'var(--color-surface-sunken)' }}>
              Avbryt
            </Button>
          </>
        ) : (
          <AssistanceReasonStep
            onSend={(note) => { void pick('needs_assistance', note); }}
            onBack={() => setStep('status')}
          />
        )}
      </div>
    </div>
  );
}
