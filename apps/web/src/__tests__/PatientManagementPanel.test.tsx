/**
 * PatientManagementPanel — team engagement display tests
 *
 * Verifies that the "Lag responderer" section correctly shows which teams
 * are responding to a patient and their Norwegian status labels.
 */
import { describe, expect, it } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { PatientManagementPanel, type FieldPatient } from '../pages/Coordinator/PatientManagementPanel';
import type { TeamPatientEngagement } from '../lib/types';

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

describe('PatientManagementPanel — team engagement display', () => {
  it('shows no "Lag responderer" section when there are no engagements', () => {
    const patient = makePatient();
    render(
      <PatientManagementPanel
        patients={[patient]}
        teams={[]}
        creating={false}
        onCreatePatient={NOOP_CREATE}
        onUpdatePatient={NOOP_UPDATE}
        teamPatientEngagements={{}}
      />,
    );

    // Expand the row
    fireEvent.click(screen.getByText('Testpasient'));
    expect(screen.queryByText('Lag responderer')).toBeNull();
  });

  it('shows the team name and Norwegian status label when a team is monitoring', () => {
    const patient = makePatient();
    const engagement: TeamPatientEngagement = {
      teamId: 'team-1',
      teamName: 'Alpha',
      patientId: 'pat-1',
      status: 'monitoring',
    };

    render(
      <PatientManagementPanel
        patients={[patient]}
        teams={[{ id: 'team-1', name: 'Alpha' }]}
        creating={false}
        onCreatePatient={NOOP_CREATE}
        onUpdatePatient={NOOP_UPDATE}
        teamPatientEngagements={{ 'pat-1': [engagement] }}
      />,
    );

    fireEvent.click(screen.getByText('Testpasient'));
    const heading = screen.getByText('Lag responderer');
    // The inline "Tilordnet lag" select also lists "Alpha" as an option, so
    // scope the lookup to the engagement section.
    const section = within(heading.parentElement as HTMLElement);
    expect(section.getByText('Alpha')).toBeTruthy();
    expect(section.getByText('Overvåker')).toBeTruthy();
    // Assigning is one interaction from the expanded row, no edit mode needed.
    expect(screen.getByTestId('assign-select-pat-1')).toBeTruthy();
    expect(screen.getByTestId('unassigned-badge-pat-1')).toBeTruthy();
  });

  it('shows "På vei" label for en_route_to_patient status', () => {
    const patient = makePatient();
    const engagement: TeamPatientEngagement = {
      teamId: 'team-2',
      teamName: 'Bravo',
      patientId: 'pat-1',
      status: 'en_route_to_patient',
    };

    render(
      <PatientManagementPanel
        patients={[patient]}
        teams={[]}
        creating={false}
        onCreatePatient={NOOP_CREATE}
        onUpdatePatient={NOOP_UPDATE}
        teamPatientEngagements={{ 'pat-1': [engagement] }}
      />,
    );

    fireEvent.click(screen.getByText('Testpasient'));
    expect(screen.getByText('På vei')).toBeTruthy();
  });

  it('shows "Transporterer" label for transporting status', () => {
    const patient = makePatient();
    const engagement: TeamPatientEngagement = {
      teamId: 'team-3',
      teamName: 'Charlie',
      patientId: 'pat-1',
      status: 'transporting',
    };

    render(
      <PatientManagementPanel
        patients={[patient]}
        teams={[]}
        creating={false}
        onCreatePatient={NOOP_CREATE}
        onUpdatePatient={NOOP_UPDATE}
        teamPatientEngagements={{ 'pat-1': [engagement] }}
      />,
    );

    fireEvent.click(screen.getByText('Testpasient'));
    expect(screen.getByText('Transporterer')).toBeTruthy();
  });

  it('shows all engaged teams when multiple teams respond to same patient', () => {
    const patient = makePatient();
    const engagements: TeamPatientEngagement[] = [
      { teamId: 'team-1', teamName: 'Alpha', patientId: 'pat-1', status: 'monitoring' },
      { teamId: 'team-2', teamName: 'Bravo', patientId: 'pat-1', status: 'en_route_to_patient' },
    ];

    render(
      <PatientManagementPanel
        patients={[patient]}
        teams={[]}
        creating={false}
        onCreatePatient={NOOP_CREATE}
        onUpdatePatient={NOOP_UPDATE}
        teamPatientEngagements={{ 'pat-1': engagements }}
      />,
    );

    fireEvent.click(screen.getByText('Testpasient'));
    expect(screen.getByText('Alpha')).toBeTruthy();
    expect(screen.getByText('Bravo')).toBeTruthy();
    expect(screen.getByText('Overvåker')).toBeTruthy();
    expect(screen.getByText('På vei')).toBeTruthy();
  });

  it('shows the patient number pill when seq is known', () => {
    render(
      <PatientManagementPanel
        patients={[makePatient({ id: 'pat-1', seq: 12 })]}
        teams={[]}
        creating={false}
        onCreatePatient={NOOP_CREATE}
        onUpdatePatient={NOOP_UPDATE}
      />,
    );
    expect(screen.getByTestId('patient-number-pat-1')).toHaveTextContent('#12');
  });

  it('shows "I sykestua" instead of "Ikke tildelt" once handed over (gap A1 / item 8.22)', () => {
    render(
      <PatientManagementPanel
        patients={[makePatient({ id: 'pat-1', assignedTeamId: null, handedOverAt: '2026-09-23T11:00:00Z' })]}
        teams={[]}
        creating={false}
        onCreatePatient={NOOP_CREATE}
        onUpdatePatient={NOOP_UPDATE}
      />,
    );
    expect(screen.getByTestId('handed-over-pat-1')).toHaveTextContent('I sykestua');
    expect(screen.queryByTestId('unassigned-badge-pat-1')).toBeNull();
  });

  it('shows "AMK varslet kl." when amkNotifiedAt is set (gap B2 / item 8.25)', () => {
    render(
      <PatientManagementPanel
        patients={[makePatient({ id: 'pat-1', amkNotifiedAt: '2026-09-23T11:40:00Z' })]}
        teams={[]}
        creating={false}
        onCreatePatient={NOOP_CREATE}
        onUpdatePatient={NOOP_UPDATE}
      />,
    );
    expect(screen.getByTestId('amk-notified-pat-1')).toHaveTextContent('AMK varslet kl.');
  });

  describe('assignment acknowledgement (gap A4 / item 8.21)', () => {
    const NOW = new Date('2026-09-23T12:00:00Z');
    const minutesAgo = (m: number) => new Date(NOW.getTime() - m * 60_000).toISOString();

    it('shows "Bekreftet av <team>" once the assigned team is en route or transporting', () => {
      render(
        <PatientManagementPanel
          patients={[makePatient({ id: 'pat-1', status: 'incoming', assignedTeamId: 'team-1', updatedAt: minutesAgo(10) })]}
          teams={[{ id: 'team-1', name: 'Alpha' }]}
          creating={false}
          onCreatePatient={NOOP_CREATE}
          onUpdatePatient={NOOP_UPDATE}
          teamPatientEngagements={{ 'pat-1': [{ teamId: 'team-1', teamName: 'Alpha', patientId: 'pat-1', status: 'transporting' }] }}
          now={NOW}
        />,
      );
      expect(screen.getByTestId('ack-confirmed-pat-1')).toHaveTextContent('Bekreftet av Alpha');
      expect(screen.queryByTestId('ack-unconfirmed-pat-1')).toBeNull();
    });

    it('shows nothing before 2 minutes, then "Ikke bekreftet · N min" after', () => {
      const { rerender } = render(
        <PatientManagementPanel
          patients={[makePatient({ id: 'pat-1', status: 'incoming', assignedTeamId: 'team-1', updatedAt: minutesAgo(1) })]}
          teams={[{ id: 'team-1', name: 'Alpha' }]}
          creating={false}
          onCreatePatient={NOOP_CREATE}
          onUpdatePatient={NOOP_UPDATE}
          teamPatientEngagements={{}}
          now={NOW}
        />,
      );
      expect(screen.queryByTestId('ack-unconfirmed-pat-1')).toBeNull();
      expect(screen.queryByTestId('ack-confirmed-pat-1')).toBeNull();

      rerender(
        <PatientManagementPanel
          patients={[makePatient({ id: 'pat-1', status: 'incoming', assignedTeamId: 'team-1', updatedAt: minutesAgo(4) })]}
          teams={[{ id: 'team-1', name: 'Alpha' }]}
          creating={false}
          onCreatePatient={NOOP_CREATE}
          onUpdatePatient={NOOP_UPDATE}
          teamPatientEngagements={{}}
          now={NOW}
        />,
      );
      expect(screen.getByTestId('ack-unconfirmed-pat-1')).toHaveTextContent('Ikke bekreftet · 4 min');
    });
  });

  it('only shows engagement section for the patient that has engagements', () => {
    const patients = [
      makePatient({ id: 'pat-1', label: 'Pasient A' }),
      makePatient({ id: 'pat-2', label: 'Pasient B' }),
    ];
    const engagements: TeamPatientEngagement[] = [
      { teamId: 'team-1', teamName: 'Alpha', patientId: 'pat-1', status: 'monitoring' },
    ];

    render(
      <PatientManagementPanel
        patients={patients}
        teams={[]}
        creating={false}
        onCreatePatient={NOOP_CREATE}
        onUpdatePatient={NOOP_UPDATE}
        teamPatientEngagements={{ 'pat-1': engagements }}
      />,
    );

    // Expand Pasient B — should NOT have Lag responderer
    fireEvent.click(screen.getByText('Pasient B'));
    expect(screen.queryByText('Lag responderer')).toBeNull();

    // Expand Pasient A — SHOULD have Lag responderer
    fireEvent.click(screen.getByText('Pasient A'));
    expect(screen.getByText('Lag responderer')).toBeTruthy();
  });
});
