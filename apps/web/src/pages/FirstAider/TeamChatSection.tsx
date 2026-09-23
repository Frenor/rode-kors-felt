/**
 * TeamChatSection
 *
 * Collapsible team messaging panel. Shows message history and a send input.
 * While collapsed, an unread badge on the header tells the patrol that a
 * message (typically from the coordinator) arrived; the parent also vibrates
 * the phone so it is noticed in the dark with the phone in a pocket.
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
  /** Messages received while the section was collapsed. */
  unreadCount?: number;
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
  unreadCount = 0,
}: TeamChatSectionProps) {
  const hasUnread = !showChat && unreadCount > 0;
  return (
    <section style={{ marginBottom: 'var(--space-4)' }} aria-label="Lagmelding">
      <button
        type="button"
        onClick={onToggleChat}
        aria-expanded={showChat}
        data-testid="firstaid-chat-toggle"
        style={{
          width: '100%',
          minHeight: 'var(--touch-min)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 'var(--space-2)',
          padding: 'var(--space-3) var(--space-4)',
          borderRadius: 'var(--radius-md)',
          border: `1px solid ${hasUnread ? 'var(--color-brand)' : 'var(--color-border)'}`,
          background: hasUnread ? 'var(--color-brand-dim)' : 'var(--color-surface)',
          color: 'var(--color-text)',
          cursor: 'pointer',
        }}
      >
        <span style={{ fontWeight: 700, fontSize: 'var(--text-base)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          Lagmelding
          {hasUnread && (
            <span
              data-testid="firstaid-chat-unread"
              aria-label={`${unreadCount} uleste meldinger`}
              style={{
                minWidth: 28,
                height: 28,
                padding: '0 8px',
                borderRadius: 'var(--radius-full)',
                background: 'var(--color-brand)',
                color: 'white',
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--text-sm)',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {unreadCount}
            </span>
          )}
        </span>
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
              maxHeight: 260,
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
                  fontSize: 'var(--text-sm)',
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
                    maxWidth: '85%',
                    padding: 'var(--space-2) var(--space-3)',
                    borderRadius: 'var(--radius-md)',
                    background: msg.fromSelf
                      ? 'var(--color-brand)'
                      : 'var(--color-surface-sunken)',
                    color: msg.fromSelf ? 'white' : 'var(--color-text)',
                    fontSize: 'var(--text-base)',
                  }}
                >
                  {!msg.fromSelf && (
                    <div
                      style={{
                        fontSize: 'var(--text-xs)',
                        fontWeight: 700,
                        marginBottom: 2,
                        opacity: 0.8,
                      }}
                    >
                      {msg.fromTeamId
                        ? teams.find((t) => t.id === msg.fromTeamId)?.name ?? 'Ukjent lag'
                        : 'Koordinator'}
                    </div>
                  )}
                  {msg.text}
                </div>
                <div
                  style={{
                    fontSize: 'var(--text-xs)',
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
              aria-label="Melding til laget"
              style={{
                flex: 1,
                minWidth: 0,
                height: 48,
                padding: '0 var(--space-3)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--color-input-border)',
                background: 'var(--color-input-bg)',
                color: 'var(--color-text)',
                fontSize: 'var(--text-base)',
              }}
            />
            <button
              type="button"
              onClick={onSend}
              disabled={!messageText.trim()}
              style={{
                height: 48,
                padding: '0 var(--space-4)',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                background: 'var(--color-brand)',
                color: 'white',
                fontSize: 'var(--text-base)',
                fontWeight: 700,
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
