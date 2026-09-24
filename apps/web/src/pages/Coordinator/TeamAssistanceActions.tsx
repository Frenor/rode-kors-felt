import { useState } from 'react';
import type { Team } from '../../lib/types';
import { Button } from '../../components/ui';

interface TeamAssistanceActionsProps {
  team: Team;
  /** Sets the team back to "ledig" — after an explicit confirm, since it hides a distress call. */
  onClear?: (teamId: string) => Promise<void> | void;
  /** Opens the message compose with this team preselected. */
  onMessage?: (teamId: string) => void;
  testIdPrefix: string;
}

/**
 * What a coordinator can do about a patrol that has asked for help, right on
 * its row: message it, or stand it down once the situation is resolved
 * (review C8). Clearing is a two-tap action on purpose.
 */
export function TeamAssistanceActions({ team, onClear, onMessage, testIdPrefix }: TeamAssistanceActionsProps) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!onClear && !onMessage) return null;

  const clear = async () => {
    if (!onClear) return;
    setBusy(true);
    try {
      await onClear(team.id);
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  };

  return (
    <span style={{ display: 'flex', gap: 'var(--space-1)', flexWrap: 'wrap', alignItems: 'center', marginLeft: 'auto' }}>
      {onMessage && !confirming && (
        <Button variant="secondary" size="sm" icon="chat" data-testid={`${testIdPrefix}-message-${team.id}`} onClick={() => onMessage(team.id)}>
          Melding
        </Button>
      )}
      {onClear && (confirming ? (
        <>
          <Button variant="danger-soft" size="sm" icon="check" disabled={busy} data-testid={`${testIdPrefix}-clear-confirm-${team.id}`} onClick={() => void clear()}>
            {busy ? 'Setter ledig…' : `Ja, sett ${team.name} ledig`}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
            Avbryt
          </Button>
        </>
      ) : (
        <Button variant="secondary" size="sm" icon="check" data-testid={`${testIdPrefix}-clear-${team.id}`} onClick={() => setConfirming(true)}>
          Avklart
        </Button>
      ))}
    </span>
  );
}
