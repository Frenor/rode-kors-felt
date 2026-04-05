import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
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
});
