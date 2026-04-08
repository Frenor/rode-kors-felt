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
    expect(screen.getByText('Lag responderer')).toBeTruthy();
    expect(screen.getByText('Alpha')).toBeTruthy();
    expect(screen.getByText('Overvåker')).toBeTruthy();
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
