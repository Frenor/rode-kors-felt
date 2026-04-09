/**
 * TeamChatSection
 *
 * Collapsible team messaging panel. Shows message history and a send input.
 * Scrolls to the bottom whenever the chat is opened or a new message arrives.
 */
import type { RefObject } from 'react';

export interface ChatMessage {
  id: string;
  text: string;
  fromTeamId?: string;
  fromSelf: boolean;
  sentAt: string;
}

export interface TeamChatSectionProps {
  messages: ChatMessage[];
  teams: Array<{ id: string; name: string }>;
  showChat: boolean;
  onToggleChat: () => void;
  messageText: string;
  onMessageTextChange: (text: string) => void;
  onSend: () => void;
  chatEndRef: RefObject<HTMLDivElement | null>;
}

export function TeamChatSection({
  messages,
  teams,
  showChat,
  onToggleChat,
  messageText,
  onMessageTextChange,
  onSend,
  chatEndRef,
}: TeamChatSectionProps) {
  return (
    <section style={{ marginBottom: 'var(--space-4)' }}>
      <button
        onClick={onToggleChat}
        style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: 'var(--space-3) var(--space-4)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--color-border)',
          background: 'var(--color-surface)',
          color: 'var(--color-text)',
          cursor: 'pointer',
        }}
      >
        <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>Lagmelding</span>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--text-xs)',
            color: 'var(--color-text-subtle)',
          }}
        >
          {messages.length > 0 ? `${messages.length} meldinger` : 'Ingen meldinger'}{' '}
          {showChat ? '▲' : '▼'}
        </span>
      </button>

      {showChat && (
        <div
          style={{
            marginTop: 'var(--space-2)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border)',
            background: 'var(--color-surface)',
            overflow: 'hidden',
          }}
        >
          {/* Message list */}
          <div
            style={{
              maxHeight: 220,
              overflowY: 'auto',
              padding: 'var(--space-3)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-2)',
            }}
          >
            {messages.length === 0 && (
              <p
                style={{
                  fontSize: 'var(--text-xs)',
                  color: 'var(--color-text-subtle)',
                  textAlign: 'center',
                }}
              >
                Ingen meldinger ennå
              </p>
            )}
            {messages.map((msg) => (
              <div
                key={msg.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: msg.fromSelf ? 'flex-end' : 'flex-start',
                }}
              >
                <div
                  style={{
                    maxWidth: '80%',
                    padding: 'var(--space-2) var(--space-3)',
                    borderRadius: 'var(--radius-md)',
                    background: msg.fromSelf
                      ? 'var(--color-brand)'
                      : 'var(--color-surface-sunken)',
                    color: msg.fromSelf ? 'white' : 'var(--color-text)',
                    fontSize: 'var(--text-sm)',
                  }}
                >
                  {!msg.fromSelf && msg.fromTeamId && (
                    <div
                      style={{
                        fontSize: 'var(--text-xs)',
                        fontWeight: 600,
                        marginBottom: 2,
                        opacity: 0.7,
                      }}
                    >
                      {teams.find((t) => t.id === msg.fromTeamId)?.name ?? 'Ukjent lag'}
                    </div>
                  )}
                  {msg.text}
                </div>
                <div
                  style={{
                    fontSize: 10,
                    color: 'var(--color-text-subtle)',
                    marginTop: 2,
                  }}
                >
                  {new Date(msg.sentAt).toLocaleTimeString('nb-NO', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          {/* Input row */}
          <div
            style={{
              display: 'flex',
              gap: 'var(--space-2)',
              padding: 'var(--space-2)',
              borderTop: '1px solid var(--color-border)',
            }}
          >
            <input
              type="text"
              value={messageText}
              onChange={(e) => onMessageTextChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  onSend();
                }
              }}
              placeholder="Skriv melding..."
              style={{
                flex: 1,
                height: 44,
                padding: '0 var(--space-3)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--color-input-border)',
                background: 'var(--color-input-bg)',
                color: 'var(--color-text)',
                fontSize: 'var(--text-sm)',
              }}
            />
            <button
              onClick={onSend}
              disabled={!messageText.trim()}
              style={{
                height: 44,
                padding: '0 var(--space-3)',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                background: 'var(--color-brand)',
                color: 'white',
                fontSize: 'var(--text-sm)',
                fontWeight: 600,
                cursor: 'pointer',
                opacity: !messageText.trim() ? 0.5 : 1,
              }}
            >
              Send
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
