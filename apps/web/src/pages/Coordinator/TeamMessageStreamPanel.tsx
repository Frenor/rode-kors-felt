import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Button } from '../../components/ui';

interface TeamMessageItem {
  id: string;
  fromTeamId?: string | null;
  /** Sender name when the message did not come from a patrol (the coordinator desk). */
  fromLabel?: string | null;
  toTeamId?: string | null;
  text: string;
  sentAt: string;
}

interface TeamMessageStreamPanelProps {
  messages: TeamMessageItem[];
  teams: Array<{ id: string; name: string }>;
  /** Send to one team (id) or to everyone (null). Resolves true when it went out. */
  onSend?: (toTeamId: string | null, text: string) => Promise<boolean> | boolean;
  /** Preselects a recipient and focuses the compose box each time the nonce changes. */
  composeTeamId?: string | null;
  composeNonce?: number;
}

function resolveTeamName(teams: Array<{ id: string; name: string }>, teamId?: string | null): string {
  if (!teamId) return 'Ukjent lag';
  return teams.find((team) => team.id === teamId)?.name ?? teamId;
}

export function TeamMessageStreamPanel({ messages, teams, onSend, composeTeamId = null, composeNonce = 0 }: TeamMessageStreamPanelProps) {
  const [toTeamId, setToTeamId] = useState<string>(composeTeamId ?? '');
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const sectionRef = useRef<HTMLElement>(null);

  // "Melding" on a team row lands here with that team already chosen.
  useEffect(() => {
    if (composeNonce === 0) return;
    setToTeamId(composeTeamId ?? '');
    sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    inputRef.current?.focus();
  }, [composeNonce, composeTeamId]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || !onSend || sending) return;
    setSending(true);
    try {
      const ok = await onSend(toTeamId || null, trimmed);
      if (ok) setText('');
    } finally {
      setSending(false);
    }
  };

  return (
    <section
      ref={sectionRef}
      aria-label="Lagsmeldinger"
      data-testid="coordinator-team-message-stream"
      className="card"
      style={{ marginBottom: 'var(--space-4)', padding: 'var(--space-3)' }}
    >
      <header style={{ marginBottom: 'var(--space-2)' }}>
        <h2 className="section-label" style={{ margin: 0 }}>
          Lagsmeldinger
        </h2>
        <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--color-text-subtle)' }}>
          Meldinger mellom lag og koordinator.
        </p>
      </header>

      {onSend && (
        <form
          onSubmit={(event) => void submit(event)}
          data-testid="coordinator-message-compose"
          style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}
        >
          <select
            className="field"
            aria-label="Til"
            data-testid="coordinator-message-to"
            value={toTeamId}
            onChange={(event) => setToTeamId(event.target.value)}
            style={{ flex: '0 1 160px', minHeight: 44, padding: '0 var(--space-2)', fontWeight: 600 }}
          >
            <option value="">Alle lag</option>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>{team.name}</option>
            ))}
          </select>
          <input
            ref={inputRef}
            className="field"
            type="text"
            aria-label="Melding"
            data-testid="coordinator-message-text"
            placeholder={toTeamId ? `Melding til ${resolveTeamName(teams, toTeamId)}…` : 'Melding til alle lag…'}
            value={text}
            onChange={(event) => setText(event.target.value)}
            maxLength={500}
            style={{ flex: '1 1 200px', minHeight: 44 }}
          />
          <Button type="submit" variant="secondary" icon="send" disabled={!text.trim() || sending} data-testid="coordinator-message-send">
            {sending ? 'Sender…' : 'Send'}
          </Button>
        </form>
      )}

      <div
        aria-live="polite"
        style={{
          maxHeight: 220,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-2)',
          paddingRight: 'var(--space-1)',
        }}
      >
        {messages.length === 0 ? (
          <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--color-text-subtle)' }}>
            Ingen lagsmeldinger ennå.
          </p>
        ) : (
          messages.map((message) => {
            const from = message.fromTeamId ? resolveTeamName(teams, message.fromTeamId) : (message.fromLabel ?? 'Ukjent avsender');
            const toTeam = message.toTeamId ? resolveTeamName(teams, message.toTeamId) : null;
            const sentAt = new Date(message.sentAt).toLocaleTimeString('nb-NO', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            });

            return (
              <article
                key={message.id}
                data-testid={`coordinator-team-message-${message.id}`}
                style={{
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-sm)',
                  padding: 'var(--space-2)',
                  background: 'var(--color-surface-sunken)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 'var(--space-2)',
                    marginBottom: 2,
                  }}
                >
                  <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700 }}>
                    {toTeam ? `${from} → ${toTeam}` : `${from} → Alle`}
                  </span>
                  <span className="data" style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-subtle)' }}>
                    {sentAt}
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--color-text)' }}>
                  {message.text}
                </p>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}
