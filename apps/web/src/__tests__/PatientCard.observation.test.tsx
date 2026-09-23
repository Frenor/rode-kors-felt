/**
 * PatientCard — "next observation due" line and the primary next-step button.
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { PatientCard } from '../pages/SickBay/PatientCard';
import type { SickBayPatient } from '../lib/types';

const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();

function makePatient(overrides: Partial<SickBayPatient> = {}): SickBayPatient {
  return {
    id: 'pat-obs-1',
    eventId: 'evt-1',
    ageGroup: 'adult',
    fullName: 'Kari Nordmann',
    status: 'incoming',
    presentingComplaint: 'Ankelskade',
    assignedClinician: '',
    vitalsHistory: [],
    latestVitals: null,
    notes: [],
    actionHistory: [],
    createdAt: minutesAgo(30),
    updatedAt: minutesAgo(1),
    ...overrides,
  };
}

function renderCard(patient: SickBayPatient, onStatusChange = vi.fn()) {
  render(
    <PatientCard
      patient={patient}
      medications={[]}
      onStatusChange={onStatusChange}
      onSubmitVitals={vi.fn()}
      onSubmitNote={vi.fn()}
      onSubmitMedication={vi.fn()}
      onLoadMedications={vi.fn()}
      onOpenAmk={vi.fn()}
      onUpdatePlacement={vi.fn()}
      onUpdateDemographics={vi.fn()}
      onUpdateComplaint={vi.fn()}
    />,
  );
  return { onStatusChange };
}

describe('PatientCard observation due line', () => {
  it('flags an overdue re-assessment on the card', () => {
    // NEWS2 1 → 6 h interval; recorded 6 h 10 min ago
    const vitals = { timestamp: minutesAgo(370), pulse: 95 };
    renderCard(makePatient({ status: 'in_treatment', latestVitals: vitals, vitalsHistory: [vitals] }));
    const line = screen.getByTestId('observation-due-pat-obs-1');
    expect(line).toHaveTextContent(/Forfalt for 10 min/);
    expect(line).toHaveAttribute('role', 'alert');
    expect(screen.getByRole('article')).toHaveAttribute('data-observation', 'overdue');
  });

  it('shows the next due time while still inside the interval', () => {
    const vitals = { timestamp: minutesAgo(10), pulse: 95 };
    renderCard(makePatient({ status: 'observation', latestVitals: vitals, vitalsHistory: [vitals] }));
    expect(screen.getByTestId('observation-due-pat-obs-1')).toHaveTextContent(/Neste vurdering kl\. \d{2}:\d{2} \(om 5 t 50 min\)/);
  });

  it('shows nothing without vitals and nothing for closed patients', () => {
    renderCard(makePatient({ status: 'in_treatment' }));
    expect(screen.queryByTestId('observation-due-pat-obs-1')).not.toBeInTheDocument();
  });

  it('hides the due line for discharged patients even with old vitals', () => {
    const vitals = { timestamp: minutesAgo(999), pulse: 95 };
    renderCard(makePatient({ status: 'discharged', latestVitals: vitals, vitalsHistory: [vitals] }));
    expect(screen.queryByTestId('observation-due-pat-obs-1')).not.toBeInTheDocument();
  });
});

describe('PatientCard primary action', () => {
  it('offers "Start behandling" as a real button for incoming patients', () => {
    const { onStatusChange } = renderCard(makePatient({ status: 'incoming' }));
    const button = screen.getByTestId('primary-action-pat-obs-1');
    expect(button).toHaveTextContent('Start behandling');
    fireEvent.click(button);
    expect(onStatusChange).toHaveBeenCalledWith('in_treatment');
  });

  it('keeps the other statuses on the dropdown only', () => {
    renderCard(makePatient({ status: 'in_treatment' }));
    expect(screen.queryByTestId('primary-action-pat-obs-1')).not.toBeInTheDocument();
  });
});
