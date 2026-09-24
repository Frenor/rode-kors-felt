/**
 * PatientCard — transport request line (gap B3 / item 8.26) and the
 * placement editor's free-number quick picks (item 8.30).
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PatientCard } from '../pages/SickBay/PatientCard';
import type { SickBayPatient, Team } from '../lib/types';

function makePatient(overrides: Partial<SickBayPatient> = {}): SickBayPatient {
  return {
    id: 'pat-transport-1',
    eventId: 'evt-1',
    ageGroup: 'adult',
    fullName: 'Ola Nordmann',
    status: 'incoming',
    presentingComplaint: 'Ankelskade',
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
const DELTA: Team = { id: 'team-delta', name: 'Delta', transport: 'atv' };

function defaultProps(patient: SickBayPatient, teams: Team[] = [], openPatients: SickBayPatient[] = []) {
  return {
    patient,
    medications: [],
    teams,
    openPatients,
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

describe('PatientCard — transport line', () => {
  it('renders nothing when no transport has been requested', () => {
    const patient = makePatient();
    render(<PatientCard {...defaultProps(patient)} />);
    expect(screen.queryByTestId('transport-line-pat-transport-1')).not.toBeInTheDocument();
  });

  it('shows the requested need and time (warning) while no team is assigned', () => {
    const patient = makePatient({ transportNeed: 'atv', transportRequestedAt: '2026-09-23T11:41:00Z' });
    render(<PatientCard {...defaultProps(patient)} />);
    const line = screen.getByTestId('transport-line-pat-transport-1');
    expect(line).toHaveTextContent(/^Transport: ATV · bedt om kl\. \d{2}:\d{2}$/);
  });

  it('shows the assigned team, its transport mode, and "på vei" (info) once a team is assigned', () => {
    const patient = makePatient({
      transportNeed: 'atv',
      transportRequestedAt: '2026-09-23T11:41:00Z',
      transportTeamId: 'team-delta',
      transportAssignedAt: '2026-09-23T11:45:00Z',
    });
    render(<PatientCard {...defaultProps(patient, [DELTA])} />);
    const line = screen.getByTestId('transport-line-pat-transport-1');
    expect(line).toHaveTextContent('Transport: Delta (ATV) på vei');
  });

  it('labels stretcher and ambulance needs correctly', () => {
    const stretcher = makePatient({ id: 'pat-a', transportNeed: 'stretcher' });
    const { unmount } = render(<PatientCard {...defaultProps(stretcher)} />);
    expect(screen.getByTestId('transport-line-pat-a')).toHaveTextContent('Transport: Båre');
    unmount();

    const ambulance = makePatient({ id: 'pat-b', transportNeed: 'ambulance' });
    render(<PatientCard {...defaultProps(ambulance)} />);
    expect(screen.getByTestId('transport-line-pat-b')).toHaveTextContent('Transport: Ambulanse');
  });
});

describe('PatientCard — journal link (item 8.32)', () => {
  it('opens the journal page in a new tab from the "Rediger detaljer" row', () => {
    const patient = makePatient();
    render(<PatientCard {...defaultProps(patient)} />);
    fireEvent.click(screen.getByTestId('edit-details-toggle-pat-transport-1'));
    const link = screen.getByTestId('journal-link-pat-transport-1');
    expect(link.getAttribute('href')).toContain('/sickbay/journal/pat-transport-1');
    expect(link).toHaveAttribute('target', '_blank');
  });
});

describe('PatientCard — placement editor free-number quick picks (item 8.30)', () => {
  it('offers the lowest free numbers for the chosen type', () => {
    const patient = makePatient();
    const openPatients = [
      patient,
      makePatient({ id: 'other-1', placementType: 'chair', placementNumber: '1' }),
      makePatient({ id: 'other-2', placementType: 'chair', placementNumber: '2' }),
    ];
    render(<PatientCard {...defaultProps(patient, [], openPatients)} />);
    fireEvent.click(screen.getByTestId('edit-details-toggle-pat-transport-1'));
    fireEvent.click(screen.getByRole('button', { name: /Rediger plassering/i }));

    const select = screen.getByLabelText('Type');
    fireEvent.change(select, { target: { value: 'chair' } });

    expect(screen.getByTestId('placement-free-3')).toBeInTheDocument();
    expect(screen.queryByTestId('placement-free-1')).not.toBeInTheDocument();
    expect(screen.queryByTestId('placement-free-2')).not.toBeInTheDocument();
  });

  it('fills the number field when a free-number chip is clicked', () => {
    const patient = makePatient();
    render(<PatientCard {...defaultProps(patient)} />);
    fireEvent.click(screen.getByTestId('edit-details-toggle-pat-transport-1'));
    fireEvent.click(screen.getByRole('button', { name: /Rediger plassering/i }));
    fireEvent.change(screen.getByLabelText('Type'), { target: { value: 'bed' } });

    fireEvent.click(screen.getByTestId('placement-free-1'));
    expect(screen.getByLabelText('Nummer')).toHaveValue('1');
  });
});
