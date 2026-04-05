interface TeamMessageItem {
  id: string;
  fromTeamId?: string | null;
  toTeamId?: string | null;
  text: string;
  sentAt: string;
}

interface TeamMessageStreamPanelProps {
  messages: TeamMessageItem[];
  teams: Array<{ id: string; name: string }>;
}

function resolveTeamName(teams: Array<{ id: string; name: string }>, teamId?: string | null): string {
  if (!teamId) return 'Ukjent lag';
  return teams.find((team) => team.id === teamId)?.name ?? teamId;
}

export function TeamMessageStreamPanel({ messages, teams }: TeamMessageStreamPanelProps) {
  return (
    <section
      aria-label="Lagsmeldinger"
      data-testid="coordinator-team-message-stream"
      style={{
        marginBottom: 'var(--space-4)',
        padding: 'var(--space-3)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--color-border)',
        background: 'var(--color-surface)',
      }}
    >
      <header style={{ marginBottom: 'var(--space-2)' }}>
        <h2 style={{ margin: 0, fontSize: 'var(--text-sm)', fontWeight: 700 }}>
          Lagsmeldinger
        </h2>
        <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--color-text-subtle)' }}>
          Live-strøm av meldinger sendt mellom lag.
        </p>
      </header>

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
            const fromTeam = resolveTeamName(teams, message.fromTeamId);
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
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', fontWeight: 700 }}>
                    {toTeam ? `${fromTeam} → ${toTeam}` : `${fromTeam} → Alle`}
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--color-text-subtle)' }}>
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
