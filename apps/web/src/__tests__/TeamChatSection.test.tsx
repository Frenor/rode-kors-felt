import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { TeamChatSection, type ChatMessage } from '../pages/FirstAider/TeamChatSection';

const teams = [{ id: 'team-alpha', name: 'Alpha' }];

function renderSection(messages: ChatMessage[], onAck = vi.fn()) {
  const chatEndRef = createRef<HTMLDivElement>();
  render(
    <TeamChatSection
      messages={messages}
      teams={teams}
      showChat
      onToggleChat={vi.fn()}
      messageText=""
      onMessageTextChange={vi.fn()}
      onSend={vi.fn()}
      chatEndRef={chatEndRef}
      onAck={onAck}
    />,
  );
  return onAck;
}

describe('TeamChatSection — Mottatt (gap B10)', () => {
  const directed: ChatMessage = {
    id: 'msg-1',
    text: 'Alpha: trekk tilbake til km 10',
    fromTeamId: undefined,
    toTeamId: 'team-alpha',
    fromSelf: false,
    sentAt: '2026-09-23T11:00:00.000Z',
  };

  it('shows a "Mottatt" button on a directed message from the coordinator', () => {
    renderSection([directed]);
    expect(screen.getByTestId('firstaid-ack-msg-1')).toBeInTheDocument();
  });

  it('does not show "Mottatt" on a broadcast message (no toTeamId)', () => {
    renderSection([{ ...directed, toTeamId: null }]);
    expect(screen.queryByTestId('firstaid-ack-msg-1')).not.toBeInTheDocument();
  });

  it('does not show "Mottatt" on a message the patrol itself sent', () => {
    renderSection([{ ...directed, fromSelf: true }]);
    expect(screen.queryByTestId('firstaid-ack-msg-1')).not.toBeInTheDocument();
  });

  it('calls onAck with the message when tapped', () => {
    const onAck = renderSection([directed]);
    fireEvent.click(screen.getByTestId('firstaid-ack-msg-1'));
    expect(onAck).toHaveBeenCalledWith(directed);
  });

  it('shows a check mark instead of the button once acknowledged', () => {
    renderSection([{ ...directed, acknowledged: true }]);
    expect(screen.queryByTestId('firstaid-ack-msg-1')).not.toBeInTheDocument();
    expect(screen.getByTestId('firstaid-ack-sent-msg-1')).toHaveTextContent('Mottatt');
  });
});
