import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { TeamMessageStreamPanel } from '../pages/Coordinator/TeamMessageStreamPanel';

describe('TeamMessageStreamPanel', () => {
  it('shows empty state when no messages exist', () => {
    render(<TeamMessageStreamPanel messages={[]} teams={[]} />);

    expect(screen.getByText('Ingen lagsmeldinger ennå.')).toBeInTheDocument();
  });

  it('renders stream rows with team names and message text', () => {
    render(
      <TeamMessageStreamPanel
        teams={[
          { id: 'team-a', name: 'Alpha' },
          { id: 'team-b', name: 'Bravo' },
        ]}
        messages={[
          {
            id: 'msg-1',
            fromTeamId: 'team-a',
            toTeamId: 'team-b',
            text: 'Vi er på vei til sektor nord.',
            sentAt: '2026-04-05T12:34:56.000Z',
          },
        ]}
      />,
    );

    expect(screen.getByText('Alpha → Bravo')).toBeInTheDocument();
    expect(screen.getByText('Vi er på vei til sektor nord.')).toBeInTheDocument();
  });

  it('names the coordinator as sender when a message has no team', () => {
    render(
      <TeamMessageStreamPanel
        teams={[{ id: 'team-a', name: 'Alpha' }]}
        messages={[{ id: 'msg-2', fromTeamId: null, fromLabel: 'Koordinator', toTeamId: 'team-a', text: 'Trekk tilbake til km 10.', sentAt: '2026-04-05T12:35:00.000Z' }]}
      />,
    );
    expect(screen.getByText('Koordinator → Alpha')).toBeInTheDocument();
  });

  it('sends a message to one team or to everyone and clears the box when it went out', async () => {
    const onSend = vi.fn().mockResolvedValue(true);
    render(<TeamMessageStreamPanel teams={[{ id: 'team-a', name: 'Alpha' }]} messages={[]} onSend={onSend} />);

    const text = screen.getByTestId('coordinator-message-text') as HTMLInputElement;
    expect(screen.getByTestId('coordinator-message-send')).toBeDisabled();
    fireEvent.change(text, { target: { value: 'Alle lag: samling ved mål kl. 14' } });
    fireEvent.click(screen.getByTestId('coordinator-message-send'));
    await waitFor(() => expect(onSend).toHaveBeenCalledWith(null, 'Alle lag: samling ved mål kl. 14'));
    await waitFor(() => expect(text.value).toBe(''));

    fireEvent.change(screen.getByTestId('coordinator-message-to'), { target: { value: 'team-a' } });
    fireEvent.change(text, { target: { value: 'Alpha: bytt til sektor C' } });
    fireEvent.submit(screen.getByTestId('coordinator-message-compose'));
    await waitFor(() => expect(onSend).toHaveBeenLastCalledWith('team-a', 'Alpha: bytt til sektor C'));
  });

  describe('receipts and "Ikke kvittert" (gap B10 / item 8.24)', () => {
    const NOW = new Date('2026-09-23T12:00:00Z');
    const minutesAgo = (m: number) => new Date(NOW.getTime() - m * 60_000).toISOString();

    it('does not render a receipt as its own row, and annotates the original message instead', () => {
      render(
        <TeamMessageStreamPanel
          teams={[{ id: 'team-a', name: 'Alpha' }]}
          messages={[
            { id: 'receipt-1', fromTeamId: 'team-a', toTeamId: 'coordinator', ackOf: 'msg-1', text: 'Mottatt', sentAt: minutesAgo(1) },
            { id: 'msg-1', fromTeamId: null, fromLabel: 'Koordinator', toTeamId: 'team-a', text: 'Trekk tilbake', sentAt: minutesAgo(5) },
          ]}
          now={NOW}
        />,
      );
      expect(screen.queryByTestId('coordinator-team-message-receipt-1')).not.toBeInTheDocument();
      expect(screen.getByTestId('coordinator-team-message-msg-1')).toBeInTheDocument();
      expect(screen.getByTestId('coordinator-message-receipt-msg-1')).toHaveTextContent('Mottatt av Alpha kl.');
      expect(screen.queryByTestId('coordinator-message-unacked-msg-1')).not.toBeInTheDocument();
    });

    it('shows "Ikke kvittert" on a directed message older than 3 minutes with no receipt', () => {
      render(
        <TeamMessageStreamPanel
          teams={[{ id: 'team-a', name: 'Alpha' }]}
          messages={[
            { id: 'msg-old', fromTeamId: null, fromLabel: 'Koordinator', toTeamId: 'team-a', text: 'Bytt sektor', sentAt: minutesAgo(4) },
          ]}
          now={NOW}
        />,
      );
      expect(screen.getByTestId('coordinator-message-unacked-msg-old')).toHaveTextContent('Ikke kvittert');
    });

    it('does not warn before 3 minutes, or for a broadcast, or for a message to the coordinator', () => {
      render(
        <TeamMessageStreamPanel
          teams={[{ id: 'team-a', name: 'Alpha' }]}
          messages={[
            { id: 'msg-fresh', fromTeamId: null, fromLabel: 'Koordinator', toTeamId: 'team-a', text: 'Nylig', sentAt: minutesAgo(1) },
            { id: 'msg-broadcast', fromTeamId: null, fromLabel: 'Koordinator', toTeamId: null, text: 'Til alle', sentAt: minutesAgo(10) },
            { id: 'msg-to-desk', fromTeamId: 'team-a', toTeamId: 'coordinator', text: 'Alpha kan ikke ta #12', sentAt: minutesAgo(10) },
          ]}
          now={NOW}
        />,
      );
      expect(screen.queryByTestId('coordinator-message-unacked-msg-fresh')).not.toBeInTheDocument();
      expect(screen.queryByTestId('coordinator-message-unacked-msg-broadcast')).not.toBeInTheDocument();
      expect(screen.queryByTestId('coordinator-message-unacked-msg-to-desk')).not.toBeInTheDocument();
      expect(screen.getByText('Alpha → Koordinator')).toBeInTheDocument();
    });
  });

  it('keeps the draft when the message could not be sent', async () => {
    const onSend = vi.fn().mockResolvedValue(false);
    render(<TeamMessageStreamPanel teams={[]} messages={[]} onSend={onSend} />);
    const text = screen.getByTestId('coordinator-message-text') as HTMLInputElement;
    fireEvent.change(text, { target: { value: 'Ikke levert' } });
    fireEvent.click(screen.getByTestId('coordinator-message-send'));
    await waitFor(() => expect(onSend).toHaveBeenCalled());
    expect(text.value).toBe('Ikke levert');
  });
});
