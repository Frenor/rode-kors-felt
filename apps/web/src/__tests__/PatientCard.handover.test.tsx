/**
 * PatientCard — hand-over line (gap A1) and patient number pill (gap A5).
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PatientCard } from '../pages/SickBay/PatientCard';
import type { SickBayPatient, Team } from '../lib/types';

function makePatient(overrides: Partial<SickBayPatient> = {}): SickBayPatient {
  return {
    id: 'pat-handover-1',
    eventId: 'evt-1',
    ageGroup: 'adult',
    fullName: 'Sofia Nilsen',
    status: 'incoming',
    presentingComplaint: 'Bruddmistanke ankel',
    assignedClinician: '',
    vitalsHistory: [],
    latestVitals: null,
    notes: [],
    actionHistory: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

const NOOP = vi.fn();

function defaultProps(patient: SickBayPatient, teams: Team[] = []) {
  return {
    patient,
    medications: [],
    teams,
    onStatusChange: NOOP,
    onSubmitVitals: NOOP,
    onSubmitNote: NOOP,
    onSubmitMedication: NOOP,
    onLoadMedications: NOOP,
    onOpenAmk: NOOP,
    onUpdatePlacement: NOOP,
    onUpdateDemographics: NOOP,
    onUpdateComplaint: NOOP,
  };
}

const ALPHA: Team = { id: 'team-alpha', name: 'Alpha', transport: 'foot' };

describe('PatientCard — hand-over line', () => {
  it('shows the team name and time when the handing-over team is known', () => {
    const patient = makePatient({ handedOverAt: '2026-09-23T11:52:00Z', handedOverByTeamId: 'team-alpha' });
    render(<PatientCard {...defaultProps(patient, [ALPHA])} />);
    const line = screen.getByTestId('handover-line-pat-handover-1');
    expect(line).toHaveTextContent(/^Overlevert av Alpha kl\. \d{2}:\d{2}$/);
  });

  it('falls back to just the time when the team is unknown', () => {
    const patient = makePatient({ handedOverAt: '2026-09-23T11:52:00Z', handedOverByTeamId: 'team-ghost' });
    render(<PatientCard {...defaultProps(patient, [ALPHA])} />);
    const line = screen.getByTestId('handover-line-pat-handover-1');
    expect(line).toHaveTextContent(/^Overlevert kl\. \d{2}:\d{2}$/);
  });

  it('renders no hand-over line when the patient was not handed over', () => {
    const patient = makePatient();
    render(<PatientCard {...defaultProps(patient)} />);
    expect(screen.queryByTestId('handover-line-pat-handover-1')).not.toBeInTheDocument();
  });
});

describe('PatientCard — patient number pill', () => {
  it('renders the shared patient number before the name', () => {
    const patient = makePatient({ seq: 4 });
    render(<PatientCard {...defaultProps(patient)} />);
    expect(screen.getByTestId('patient-number-pat-handover-1')).toHaveTextContent('#4');
  });

  it('renders nothing when the number is not yet known', () => {
    const patient = makePatient({ seq: null });
    render(<PatientCard {...defaultProps(patient)} />);
    expect(screen.queryByTestId('patient-number-pat-handover-1')).not.toBeInTheDocument();
  });
});
