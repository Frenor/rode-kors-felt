/**
 * AssistanceReasonStep
 *
 * Second step of the team status sheet, shown after tapping "Trenger bistand"
 * (gap A3). "Trenger bistand" used to send only the status — the coordinator
 * saw "Alpha trenger bistand" and had to radio to ask what. This is a
 * one-tap "hva": Flere hender / Transport / AMK er varslet / Annet, plus an
 * optional free-text addendum, encoded into the `team.status_set` note the
 * API already accepts.
 */
import { useState } from 'react';
import { Button } from '../../components/ui';

export interface AssistanceReasonOption {
  id: string;
  label: string;
}

export const ASSISTANCE_REASONS: AssistanceReasonOption[] = [
  { id: 'more_hands', label: 'Flere hender' },
  { id: 'transport', label: 'Transport' },
  { id: 'amk_notified', label: 'AMK er varslet' },
  { id: 'other', label: 'Annet' },
];

/** Encodes a chosen reason (+ optional free text) into the status-set note. */
export function encodeAssistanceNote(reasonId: string, text: string): string {
  const trimmed = text.trim();
  return trimmed ? `${reasonId}: ${trimmed}` : reasonId;
}

/** Reads a status-set note back into a Norwegian phrase for the banner. */
export function describeAssistanceNote(note: string | null | undefined): string | null {
  if (!note) return null;
  const sepIndex = note.indexOf(':');
  const id = (sepIndex === -1 ? note : note.slice(0, sepIndex)).trim();
  const reason = ASSISTANCE_REASONS.find((r) => r.id === id);
  // An unrecognised note (e.g. a patient label from the per-patient "Trenger
  // bistand her" button) is still shown, never hidden.
  if (!reason) return note;
  const extra = sepIndex === -1 ? '' : note.slice(sepIndex + 1).trim();
  return extra ? `${reason.label} — ${extra}` : reason.label;
}

export interface AssistanceReasonStepProps {
  /** `note` is the encoded reason, or undefined for "Send uten detaljer". */
  onSend: (note: string | undefined) => void;
  onBack: () => void;
}

export function AssistanceReasonStep({ onSend, onBack }: AssistanceReasonStepProps) {
  const [reasonId, setReasonId] = useState<string | null>(null);
  const [text, setText] = useState('');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      <div style={{ fontWeight: 700, fontSize: 'var(--text-lg)' }}>Hva trenger dere?</div>

      <div
        role="radiogroup"
        aria-label="Hva trenger dere"
        data-testid="firstaid-assist-reasons"
        style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--space-2)' }}
      >
        {ASSISTANCE_REASONS.map((reason) => {
          const active = reasonId === reason.id;
          return (
            <Button
              key={reason.id}
              variant="tone"
              tone={{ color: 'var(--color-status-critical)', bg: 'var(--color-status-critical-bg)' }}
              size="lg"
              role="radio"
              aria-checked={active}
              icon={active ? 'check' : undefined}
              data-testid={`firstaid-assist-reason-${reason.id}`}
              onClick={() => setReasonId((prev) => (prev === reason.id ? null : reason.id))}
              style={{ padding: '0 var(--space-2)', minHeight: 56 }}
            >
              {reason.label}
            </Button>
          );
        })}
      </div>

      <div>
        <label htmlFor="assist-reason-text" className="section-label" style={{ display: 'block', marginBottom: 'var(--space-2)' }}>
          Tillegg (valgfritt)
        </label>
        <input
          id="assist-reason-text"
          className="field"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="f.eks. båre til km 12"
        />
      </div>

      <Button
        variant="danger"
        size="lg"
        block
        disabled={!reasonId}
        data-testid="firstaid-assist-reason-send"
        onClick={() => onSend(reasonId ? encodeAssistanceNote(reasonId, text) : undefined)}
      >
        Send
      </Button>
      <Button variant="secondary" size="lg" block data-testid="firstaid-assist-reason-skip" onClick={() => onSend(undefined)}>
        Send uten detaljer
      </Button>
      <Button variant="ghost" size="md" block onClick={onBack}>
        Tilbake
      </Button>
    </div>
  );
}
