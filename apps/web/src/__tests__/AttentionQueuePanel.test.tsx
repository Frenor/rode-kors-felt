/**
 * AttentionQueuePanel — the coordinator's "what needs me now" list.
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { AttentionQueuePanel } from '../pages/Coordinator/AttentionQueuePanel';
import type { FieldPatient } from '../pages/Coordinator/PatientManagementPanel';
import type { Team } from '../lib/types';

const NOW = new Date('2026-09-23T12:00:00Z');
const minutesAgo = (m: number) => new Date(NOW.getTime() - m * 60_000).toISOString();

const TEAMS: Team[] = [
  { id: 't-alpha', name: 'Alpha', operationalStatus: 'available' },
  { id: 't-bravo', name: 'Bravo', operationalStatus: 'needs_assistance', statusNote: 'Bevisstløs ved mål', statusUpdatedAt: minutesAgo(4) },
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

describe('AttentionQueuePanel', () => {
  it('shows an explicit empty state when nothing is pending', () => {
    render(
      <AttentionQueuePanel
        teams={[{ id: 't-alpha', name: 'Alpha', operationalStatus: 'available' }]}
        patients={[patient({ id: 'p1', assignedTeamId: 't-alpha' })]}
        alerts={[]}
        onAssignTeam={vi.fn()}
        onDismissAlert={vi.fn()}
        now={NOW}
      />,
    );
    expect(screen.getByTestId('attention-queue-empty')).toBeInTheDocument();
    expect(screen.getByTestId('attention-queue-count')).toHaveTextContent('Ingen ventende');
  });

  it('lists teams needing assistance, unassigned patients by triage then age, and alerts with names', () => {
    const patients = [
      patient({ id: 'p-green', label: 'Grønn gammel', triageStatus: 'green', updatedAt: minutesAgo(30) }),
      patient({ id: 'p-red', label: 'Rød ny', triageStatus: 'red', updatedAt: minutesAgo(2) }),
      patient({ id: 'p-untriaged', label: 'Uten triage', triageStatus: null, updatedAt: minutesAgo(10) }),
      patient({ id: 'p-assigned', label: 'Har lag', triageStatus: 'red', assignedTeamId: 't-alpha' }),
      patient({ id: 'p-closed', label: 'Lukket', triageStatus: 'red', status: 'discharged' }),
    ];
    render(
      <AttentionQueuePanel
        teams={TEAMS}
        patients={patients}
        alerts={[{ patientId: 'p-assigned', news2Score: 7, ratePerHour: 3, receivedAt: minutesAgo(1) }]}
        onAssignTeam={vi.fn()}
        onDismissAlert={vi.fn()}
        now={NOW}
      />,
    );

    // 1 team + 3 unassigned + 1 alert
    expect(screen.getByTestId('attention-queue-count')).toHaveTextContent('5 oppgaver');

    const bravo = screen.getByTestId('attention-team-t-bravo');
    expect(within(bravo).getByText('Bravo')).toBeInTheDocument();
    expect(within(bravo).getByText('Bevisstløs ved mål')).toBeInTheDocument();

    const rows = screen.getAllByTestId(/^attention-patient-/).map((el) => el.getAttribute('data-testid'));
    expect(rows).toEqual(['attention-patient-p-red', 'attention-patient-p-untriaged', 'attention-patient-p-green']);
    expect(screen.queryByTestId('attention-patient-p-assigned')).not.toBeInTheDocument();
    expect(screen.queryByTestId('attention-patient-p-closed')).not.toBeInTheDocument();
    expect(within(screen.getByTestId('attention-patient-p-green')).getByText(/meldt for 30 min siden/)).toBeInTheDocument();

    const alert = screen.getByTestId('attention-alert-p-assigned');
    expect(within(alert).getByText('Har lag')).toBeInTheDocument();
    expect(within(alert).getByText(/Lag: Alpha/)).toBeInTheDocument();
  });

  it('assigns a team in one interaction from the row', async () => {
    const onAssignTeam = vi.fn().mockResolvedValue(undefined);
    render(
      <AttentionQueuePanel
        teams={TEAMS}
        patients={[patient({ id: 'p1', label: 'Uten lag' })]}
        alerts={[]}
        onAssignTeam={onAssignTeam}
        onDismissAlert={vi.fn()}
        now={NOW}
      />,
    );
    fireEvent.change(screen.getByTestId('attention-assign-p1'), { target: { value: 't-alpha' } });
    await waitFor(() => expect(onAssignTeam).toHaveBeenCalledWith('p1', 't-alpha'));
  });

  it('dismisses an alert', () => {
    const onDismissAlert = vi.fn();
    render(
      <AttentionQueuePanel
        teams={TEAMS}
        patients={[patient({ id: 'p1', label: 'Forverring', assignedTeamId: 't-alpha' })]}
        alerts={[{ patientId: 'p1', news2Score: 8, ratePerHour: 4, receivedAt: minutesAgo(1) }]}
        onAssignTeam={vi.fn()}
        onDismissAlert={onDismissAlert}
        now={NOW}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Fjern varsel for Forverring' }));
    expect(onDismissAlert).toHaveBeenCalledWith('p1');
  });
});
