/**
 * TriageChips
 *
 * Grønn / Gul / Rød / Svart triage picker (gap A2). Triage is a moving
 * judgement — the yellow ankle becomes red when the pulse climbs — but only
 * the coordinator could change it after "Meld pasient". Reused inside the
 * field summary editor's "Rediger sammendrag / posisjon" disclosure.
 */
import { FIELD_TRIAGE_ORDER, FIELD_TRIAGE_STYLE, type FieldTriageStatus } from '../../lib/constants';
import { Button } from '../../components/ui';

export interface TriageChipsProps {
  value: FieldTriageStatus | null;
  onChange: (value: FieldTriageStatus) => void;
  /** Prefixes each chip's data-testid: `${idPrefix}-${value}`. */
  idPrefix?: string;
}

export function TriageChips({ value, onChange, idPrefix }: TriageChipsProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Triagefarge"
      style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-2)' }}
    >
      {FIELD_TRIAGE_ORDER.map((option) => {
        const style = FIELD_TRIAGE_STYLE[option];
        const active = value === option;
        return (
          <Button
            key={option}
            variant="tone"
            tone={{ color: style.text, bg: style.bg }}
            size="lg"
            role="radio"
            aria-checked={active}
            icon={active ? 'check' : undefined}
            data-testid={idPrefix ? `${idPrefix}-${option}` : undefined}
            onClick={() => onChange(option)}
            style={{ padding: 0 }}
          >
            {style.label}
          </Button>
        );
      })}
    </div>
  );
}
