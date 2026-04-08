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
      className="card-p3 mb-4"
    >
      <header className="mb-2">
        <h2 className="text-sm fw-700" style={{ margin: 0 }}>
          Lagsmeldinger
        </h2>
        <p className="text-xs-subtle" style={{ margin: 0 }}>
          Live-strøm av meldinger sendt mellom lag.
        </p>
      </header>

      <div
        aria-live="polite"
        className="flex-col gap-2"
        style={{
          maxHeight: 220,
          overflowY: 'auto',
          paddingRight: 'var(--space-1)',
        }}
      >
        {messages.length === 0 ? (
          <p className="text-sm text-subtle" style={{ margin: 0 }}>
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
                  className="flex-between gap-2"
                  style={{ marginBottom: 2 }}
                >
                  <span className="mono-xs fw-700">
                    {toTeam ? `${fromTeam} → ${toTeam}` : `${fromTeam} → Alle`}
                  </span>
                  <span className="mono-xs-subtle">
                    {sentAt}
                  </span>
                </div>
                <p className="text-sm" style={{ margin: 0, color: 'var(--color-text)' }}>
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
