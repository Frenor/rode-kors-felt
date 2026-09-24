import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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

  describe('"Send til" dispatch (gap B4 / item 8.23)', () => {
    it('is available on every row, regardless of status', () => {
      render(<TeamStatusPanel teams={teams} onDispatchTeam={vi.fn()} />);
      expect(screen.getByTestId('team-status-dispatch-t-alpha')).toBeInTheDocument();
      expect(screen.getByTestId('team-status-dispatch-t-bravo')).toBeInTheDocument();
      expect(screen.getByTestId('team-status-dispatch-t-charlie')).toBeInTheDocument();
    });

    it('sends a sector and shows it on the row until changed', async () => {
      const onDispatchTeam = vi.fn().mockResolvedValue(undefined);
      render(<TeamStatusPanel teams={[teams[0]!]} onDispatchTeam={onDispatchTeam} />);

      fireEvent.click(screen.getByTestId('team-status-dispatch-t-alpha'));
      const input = screen.getByTestId('team-status-dispatch-input-t-alpha');
      fireEvent.change(input, { target: { value: 'Sektor B' } });
      fireEvent.click(screen.getByRole('button', { name: 'Send' }));

      await waitFor(() => expect(onDispatchTeam).toHaveBeenCalledWith('t-alpha', 'Sektor B'));
    });

    it('shows the last dispatched sector (mono) on the row', () => {
      render(
        <TeamStatusPanel
          teams={[teams[0]!]}
          onDispatchTeam={vi.fn()}
          sectors={{ 't-alpha': { sector: 'Sektor B', assignedAt: '2026-09-23T12:00:00Z' } }}
        />,
      );
      expect(screen.getByTestId('team-status-sector-t-alpha')).toHaveTextContent('Sektor B');
    });

    it('does nothing without an onDispatchTeam handler', () => {
      render(<TeamStatusPanel teams={[teams[0]!]} />);
      expect(screen.queryByTestId('team-status-dispatch-t-alpha')).toBeNull();
    });
  });
});
