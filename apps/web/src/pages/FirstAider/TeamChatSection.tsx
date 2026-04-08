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
    <section className="mb-4">
      <button
        onClick={onToggleChat}
        className="card flex-between"
        style={{ width: '100%', padding: 'var(--space-3) var(--space-4)', color: 'var(--color-text)', cursor: 'pointer' }}
      >
        <span className="text-sm fw-600">Lagmelding</span>
        <span className="mono-xs-subtle">
          {messages.length > 0 ? `${messages.length} meldinger` : 'Ingen meldinger'}{' '}
          {showChat ? '▲' : '▼'}
        </span>
      </button>

      {showChat && (
        <div
          className="card mt-2"
          style={{ overflow: 'hidden' }}
        >
          {/* Message list */}
          <div
            className="flex-col gap-2"
            style={{ maxHeight: 220, overflowY: 'auto', padding: 'var(--space-3)' }}
          >
            {messages.length === 0 && (
              <p
                className="text-xs-subtle"
                style={{ textAlign: 'center' }}
              >
                Ingen meldinger ennå
              </p>
            )}
            {messages.map((msg) => (
              <div
                key={msg.id}
                className="flex-col"
                style={{ alignItems: msg.fromSelf ? 'flex-end' : 'flex-start' }}
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
                      className="text-xs fw-600"
                      style={{ marginBottom: 2, opacity: 0.7 }}
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
            className="flex gap-2"
            style={{ padding: 'var(--space-2)', borderTop: '1px solid var(--color-border)' }}
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
              className="flex-1 form-input-sm"
              style={{ height: 44, fontSize: 'var(--text-sm)' }}
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
