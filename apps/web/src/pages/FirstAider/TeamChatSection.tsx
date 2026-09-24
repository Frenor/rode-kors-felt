/**
 * TeamChatSection
 *
 * Collapsible team messaging panel. Shows message history and a send input.
 * While collapsed, an unread badge on the header tells the patrol that a
 * message (typically from the coordinator) arrived; the parent also vibrates
 * the phone so it is noticed in the dark with the phone in a pocket.
 */
import type { RefObject } from 'react';
import { Button, Icon } from '../../components/ui';

export interface ChatMessage {
  id: string;
  text: string;
  fromTeamId?: string;
  /** Set when the coordinator addressed this message to one patrol only. */
  toTeamId?: string | null;
  fromSelf: boolean;
  sentAt: string;
  /** True once this patrol has sent its "Mottatt" receipt back. */
  acknowledged?: boolean;
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
  /** "Mottatt" on a directed message (gap B10) — undefined disables the button. */
  onAck?: (message: ChatMessage) => void;
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
  onAck,
}: TeamChatSectionProps) {
  const hasUnread = !showChat && unreadCount > 0;
  return (
    <section style={{ marginBottom: 'var(--space-4)' }} aria-label="Lagmelding">
      <button
        type="button"
        onClick={onToggleChat}
        aria-expanded={showChat}
        data-testid="firstaid-chat-toggle"
        className="card"
        style={{
          width: '100%',
          minHeight: 'var(--touch-min)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 'var(--space-2)',
          padding: 'var(--space-3) var(--space-4)',
          borderColor: hasUnread ? 'var(--color-brand)' : undefined,
          background: hasUnread ? 'var(--color-brand-dim)' : undefined,
          color: 'var(--color-text)',
          cursor: 'pointer',
          font: 'inherit',
        }}
      >
        <span style={{ fontWeight: 700, fontSize: 'var(--text-base)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <Icon name="chat" />
          Lagmelding
          {hasUnread && (
            <span
              data-testid="firstaid-chat-unread"
              aria-label={`${unreadCount} uleste meldinger`}
              className="data"
              style={{
                minWidth: 28,
                height: 28,
                padding: '0 8px',
                borderRadius: 'var(--radius-full)',
                background: 'var(--color-brand)',
                color: 'white',
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
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
          {messages.length > 0 ? `${messages.length} meldinger` : 'Ingen meldinger'}
          <Icon name={showChat ? 'chevronUp' : 'chevronDown'} />
        </span>
      </button>

      {showChat && (
        <div
          className="card"
          style={{
            marginTop: 'var(--space-2)',
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
                  className="data"
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
                {/* Directed instruction from the coordinator — radio discipline
                    expects a read-back (gap B10). */}
                {!msg.fromSelf && msg.toTeamId && (
                  msg.acknowledged ? (
                    <div
                      data-testid={`firstaid-ack-sent-${msg.id}`}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 'var(--space-1)',
                        fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--color-status-ok)', marginTop: 2,
                      }}
                    >
                      <Icon name="check" size="sm" /> Mottatt
                    </div>
                  ) : (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => onAck?.(msg)}
                      disabled={!onAck}
                      data-testid={`firstaid-ack-${msg.id}`}
                      style={{ marginTop: 'var(--space-1)' }}
                    >
                      Mottatt
                    </Button>
                  )
                )}
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
              className="field"
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
              style={{ flex: 1, minWidth: 0 }}
            />
            <Button variant="primary" icon="send" onClick={onSend} disabled={!messageText.trim()}>
              Send
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
