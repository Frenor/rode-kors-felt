/**
 * AttentionQueuePanel — Transport queue group (gap B3 / item 8.26).
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { AttentionQueuePanel } from '../pages/Coordinator/AttentionQueuePanel';
import type { FieldPatient } from '../pages/Coordinator/PatientManagementPanel';
import type { Team } from '../lib/types';

const NOW = new Date('2026-09-23T12:00:00Z');
const minutesAgo = (m: number) => new Date(NOW.getTime() - m * 60_000).toISOString();

const TEAMS: Team[] = [
  { id: 't-alpha', name: 'Alpha', transport: 'foot', operationalStatus: 'available' },
  { id: 't-delta', name: 'Delta', transport: 'atv', operationalStatus: 'available' },
];

function patient(overrides: Partial<FieldPatient>): FieldPatient {
  return {
    id: 'p',
    label: 'Pasient',
    triageStatus: null,
    description: null,
    positionText: null,
    lat: null,
    lon: null,
    assignedTeamId: null,
    updatedAt: minutesAgo(1),
    status: 'incoming',
    ...overrides,
  };
}

describe('AttentionQueuePanel — Transport (gap B3 / item 8.26)', () => {
  it('lists an open patient with a pending transport request', () => {
    render(
      <AttentionQueuePanel
        teams={TEAMS}
        patients={[patient({
          id: 'p1',
          label: 'Trenger transport',
          transportNeed: 'atv',
          transportPickupText: 'Ved kiosken',
          transportRequestedAt: minutesAgo(5),
        })]}
        alerts={[]}
        onAssignTeam={vi.fn()}
        onDismissAlert={vi.fn()}
        onAssignTransport={vi.fn()}
        now={NOW}
      />,
    );

    const row = screen.getByTestId('attention-transport-p1');
    expect(within(row).getByText('ATV')).toBeInTheDocument();
    expect(within(row).getByText(/Ved kiosken/)).toBeInTheDocument();
    expect(within(row).getByText(/bedt om for 5 min siden/)).toBeInTheDocument();
    // Counted in the total.
    expect(screen.getByTestId('attention-queue-count')).toHaveTextContent('1 oppgave');
  });

  it('excludes a patient once a transport team is already assigned', () => {
    render(
      <AttentionQueuePanel
        teams={TEAMS}
        patients={[patient({ id: 'p1', transportNeed: 'atv', transportTeamId: 't-delta' })]}
        alerts={[]}
        onAssignTeam={vi.fn()}
        onDismissAlert={vi.fn()}
        onAssignTransport={vi.fn()}
        now={NOW}
      />,
    );
    expect(screen.queryByTestId('attention-transport-p1')).not.toBeInTheDocument();
    expect(screen.getByTestId('attention-queue-empty')).toBeInTheDocument();
  });

  it('excludes a handed-over patient even with an open transport request (gap A1)', () => {
    render(
      <AttentionQueuePanel
        teams={TEAMS}
        patients={[patient({ id: 'p1', transportNeed: 'stretcher', handedOverAt: minutesAgo(2) })]}
        alerts={[]}
        onAssignTeam={vi.fn()}
        onDismissAlert={vi.fn()}
        onAssignTransport={vi.fn()}
        now={NOW}
      />,
    );
    expect(screen.queryByTestId('attention-transport-p1')).not.toBeInTheDocument();
  });

  it('lists teams with a vehicle or ATV first in the assign select', () => {
    render(
      <AttentionQueuePanel
        teams={TEAMS}
        patients={[patient({ id: 'p1', transportNeed: 'atv' })]}
        alerts={[]}
        onAssignTeam={vi.fn()}
        onDismissAlert={vi.fn()}
        onAssignTransport={vi.fn()}
        now={NOW}
      />,
    );
    const select = screen.getByTestId('attention-transport-assign-p1');
    const optionLabels = within(select).getAllByRole('option').map((o) => o.textContent);
    // Delta (ATV) sorts before Alpha (foot), regardless of input order.
    expect(optionLabels[1]).toMatch(/^Delta/);
    expect(optionLabels[2]).toMatch(/^Alpha/);
    expect(optionLabels[1]).toContain('ATV');
    expect(optionLabels[1]).toContain('Ledig');
  });

  it('calls onAssignTransport with the patient and chosen team', async () => {
    const onAssignTransport = vi.fn().mockResolvedValue(undefined);
    render(
      <AttentionQueuePanel
        teams={TEAMS}
        patients={[patient({ id: 'p1', transportNeed: 'ambulance' })]}
        alerts={[]}
        onAssignTeam={vi.fn()}
        onDismissAlert={vi.fn()}
        onAssignTransport={onAssignTransport}
        now={NOW}
      />,
    );
    fireEvent.change(screen.getByTestId('attention-transport-assign-p1'), { target: { value: 't-delta' } });
    await waitFor(() => expect(onAssignTransport).toHaveBeenCalledWith('p1', 't-delta'));
  });

  it('shows a fallback when no pickup text is given', () => {
    render(
      <AttentionQueuePanel
        teams={TEAMS}
        patients={[patient({ id: 'p1', transportNeed: 'stretcher', transportPickupText: null })]}
        alerts={[]}
        onAssignTeam={vi.fn()}
        onDismissAlert={vi.fn()}
        onAssignTransport={vi.fn()}
        now={NOW}
      />,
    );
    expect(within(screen.getByTestId('attention-transport-p1')).getByText(/Hentested ikke oppgitt/)).toBeInTheDocument();
  });
});
