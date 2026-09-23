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
