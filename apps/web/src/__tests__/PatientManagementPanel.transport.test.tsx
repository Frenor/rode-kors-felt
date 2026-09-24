/**
 * PatientManagementPanel — transport pill and "Fjern" (gap B3 / item 8.26).
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PatientManagementPanel, type FieldPatient } from '../pages/Coordinator/PatientManagementPanel';

const NOOP_CREATE = async () => {};
const NOOP_UPDATE = async () => {};

function makePatient(overrides: Partial<FieldPatient> = {}): FieldPatient {
  return {
    id: 'pat-1',
    label: 'Testpasient',
    triageStatus: 'green',
    description: null,
    positionText: null,
    lat: null,
    lon: null,
    assignedTeamId: null,
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('PatientManagementPanel — transport pill (gap B3 / item 8.26)', () => {
  it('shows nothing when there is no transport request', () => {
    render(
      <PatientManagementPanel
        patients={[makePatient()]}
        teams={[]}
        creating={false}
        onCreatePatient={NOOP_CREATE}
        onUpdatePatient={NOOP_UPDATE}
      />,
    );
    expect(screen.queryByTestId('transport-pill-pat-1')).toBeNull();
  });

  it('shows "Transport bedt om: <need>" while pending', () => {
    render(
      <PatientManagementPanel
        patients={[makePatient({ transportNeed: 'atv' })]}
        teams={[]}
        creating={false}
        onCreatePatient={NOOP_CREATE}
        onUpdatePatient={NOOP_UPDATE}
      />,
    );
    expect(screen.getByTestId('transport-pill-pat-1')).toHaveTextContent('Transport bedt om: ATV');
  });

  it('shows "Transport: <team> (<need>) · tildelt kl." once assigned', () => {
    render(
      <PatientManagementPanel
        patients={[makePatient({
          transportNeed: 'atv',
          transportTeamId: 'team-delta',
          transportAssignedAt: '2026-09-23T11:41:00Z',
        })]}
        teams={[{ id: 'team-delta', name: 'Delta' }]}
        creating={false}
        onCreatePatient={NOOP_CREATE}
        onUpdatePatient={NOOP_UPDATE}
      />,
    );
    const pill = screen.getByTestId('transport-pill-pat-1');
    expect(pill).toHaveTextContent('Transport: Delta (ATV)');
    expect(pill).toHaveTextContent('tildelt kl.');
  });

  it('calls onClearTransport from the "Fjern" button in the expanded row', async () => {
    const onClearTransport = vi.fn().mockResolvedValue(undefined);
    render(
      <PatientManagementPanel
        patients={[makePatient({ transportNeed: 'stretcher' })]}
        teams={[]}
        creating={false}
        onCreatePatient={NOOP_CREATE}
        onUpdatePatient={NOOP_UPDATE}
        onClearTransport={onClearTransport}
      />,
    );
    fireEvent.click(screen.getByText('Testpasient'));
    fireEvent.click(screen.getByTestId('transport-clear-pat-1'));
    await waitFor(() => expect(onClearTransport).toHaveBeenCalledWith('pat-1'));
  });

  it('does not show the "Fjern" button without a transport request', () => {
    render(
      <PatientManagementPanel
        patients={[makePatient()]}
        teams={[]}
        creating={false}
        onCreatePatient={NOOP_CREATE}
        onUpdatePatient={NOOP_UPDATE}
        onClearTransport={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText('Testpasient'));
    expect(screen.queryByTestId('transport-clear-pat-1')).toBeNull();
  });
});
