/**
 * PatientCard — "AMK varslet" pill on the card header (gap B2).
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PatientCard } from '../pages/SickBay/PatientCard';
import type { SickBayPatient } from '../lib/types';

function makePatient(overrides: Partial<SickBayPatient> = {}): SickBayPatient {
  return {
    id: 'pat-amk-1',
    eventId: 'evt-1',
    ageGroup: 'adult',
    fullName: 'Kari Nordmann',
    status: 'in_treatment',
    presentingComplaint: 'Brystsmerter',
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

function renderCard(patient: SickBayPatient) {
  render(
    <PatientCard
      patient={patient}
      medications={[]}
      onStatusChange={NOOP}
      onSubmitVitals={NOOP}
      onSubmitNote={NOOP}
      onSubmitMedication={NOOP}
      onLoadMedications={NOOP}
      onOpenAmk={NOOP}
      onUpdatePlacement={NOOP}
      onUpdateDemographics={NOOP}
      onUpdateComplaint={NOOP}
    />,
  );
}

describe('PatientCard — AMK notified pill', () => {
  it('shows the AMK varslet pill with the time once amkNotifiedAt is set', () => {
    renderCard(makePatient({ amkNotifiedAt: '2026-09-23T11:40:00Z' }));
    const pill = screen.getByTestId('amk-notified-pill-pat-amk-1');
    expect(pill).toHaveTextContent(/^AMK varslet kl\. \d{2}:\d{2}$/);
  });

  it('renders no pill before AMK has been notified', () => {
    renderCard(makePatient({ amkNotifiedAt: null }));
    expect(screen.queryByTestId('amk-notified-pill-pat-amk-1')).not.toBeInTheDocument();
  });
});
