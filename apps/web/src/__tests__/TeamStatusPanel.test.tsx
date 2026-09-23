import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { TeamStatusPanel } from '../pages/Coordinator/TeamStatusPanel';
import type { Team } from '../lib/types';

const teams: Team[] = [
  { id: 't-alpha', name: 'Alpha', transport: 'foot', operationalStatus: 'available', statusNote: null, statusUpdatedAt: null },
  { id: 't-bravo', name: 'Bravo', transport: 'atv', operationalStatus: 'needs_assistance', statusNote: 'Bevisstløs pasient ved mål', statusUpdatedAt: '2026-04-11T10:15:00Z' },
  { id: 't-charlie', name: 'Charlie', transport: 'bike', operationalStatus: 'on_scene', statusNote: null, statusUpdatedAt: null },
];

describe('TeamStatusPanel', () => {
  it('renders an empty state when the event has no teams', () => {
    render(<TeamStatusPanel teams={[]} />);
    expect(screen.getByText('Ingen lag registrert')).toBeInTheDocument();
  });

  it('shows Norwegian status labels and pins teams needing assistance to the top', () => {
    render(<TeamStatusPanel teams={teams} />);

    const rows = screen.getAllByTestId(/^team-status-row-/);
    expect(rows.map((row) => row.getAttribute('data-testid'))).toEqual([
      'team-status-row-t-bravo',
      'team-status-row-t-charlie',
      'team-status-row-t-alpha',
    ]);

    const bravo = screen.getByTestId('team-status-row-t-bravo');
    expect(within(bravo).getByText('Trenger bistand')).toBeInTheDocument();
    expect(within(bravo).getByText('Bevisstløs pasient ved mål')).toBeInTheDocument();
    expect(bravo).toHaveAttribute('data-status', 'needs_assistance');

    expect(within(screen.getByTestId('team-status-row-t-alpha')).getByText('Ledig')).toBeInTheDocument();
    expect(within(screen.getByTestId('team-status-row-t-charlie')).getByText('Fremme på stedet')).toBeInTheDocument();
  });

  it('announces how many teams need assistance', () => {
    render(<TeamStatusPanel teams={teams} />);
    expect(screen.getByTestId('team-status-needs-assistance-count')).toHaveTextContent('1 trenger bistand');
  });

  it('offers stand-down and message actions only for teams needing assistance', () => {
    const onClearAssistance = vi.fn();
    render(<TeamStatusPanel teams={teams} onClearAssistance={onClearAssistance} onMessageTeam={vi.fn()} />);
    expect(screen.getByTestId('team-status-clear-t-bravo')).toBeInTheDocument();
    expect(screen.queryByTestId('team-status-clear-t-alpha')).toBeNull();
    fireEvent.click(screen.getByTestId('team-status-clear-t-bravo'));
    fireEvent.click(screen.getByTestId('team-status-clear-confirm-t-bravo'));
    expect(onClearAssistance).toHaveBeenCalledWith('t-bravo');
  });

  it('treats a team without a recorded status as available', () => {
    render(<TeamStatusPanel teams={[{ id: 't-new', name: 'Delta' }]} />);
    expect(within(screen.getByTestId('team-status-row-t-new')).getByText('Ledig')).toBeInTheDocument();
    expect(screen.queryByTestId('team-status-needs-assistance-count')).toBeNull();
  });
});
