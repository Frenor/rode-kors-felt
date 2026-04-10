/**
 * PatientCard — editor focus-stability tests
 *
 * Verifies that typing in the inline editors (complaint, demographics, placement)
 * is not interrupted by a concurrent parent re-render that supplies a new patient
 * object reference with the same field values (e.g. after a vitals WebSocket push
 * or a fetchPatients() call while the user is mid-edit).
 *
 * The critical invariant: re-rendering PatientCard with a structurally-identical
 * patient prop must NOT reset the draft value or steal focus from the active input.
 */

import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PatientCard } from '../pages/SickBay/PatientCard';
import type { SickBayPatient } from '../lib/types';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('@rkf/shared-types', () => ({
  calculateNEWS2: vi.fn(() => ({ total: 0, alertLevel: 'routine', scores: {}, missingInputs: [] })),
  calculateNEWS2Trend: vi.fn(() => null),
  news2MonitoringLabel: vi.fn(() => 'Minimum 12 timer'),
  news2BadgeLabel: vi.fn(() => 'Rutine'),
}));

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

function makePatient(overrides: Partial<SickBayPatient> = {}): SickBayPatient {
  return {
    id: 'pat-focus-1',
    eventId: 'evt-1',
    ageGroup: 'adult',
    fullName: 'Ola Nordmann',
    birthDate: '1985-03-12',
    gender: 'male',
    status: 'in_treatment',
    presentingComplaint: 'Brystsmerter',
    assignedClinician: '',
    placementType: 'bed',
    placementNumber: '3',
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

function defaultProps(patient: SickBayPatient) {
  return {
    patient,
    medications: [],
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Return a new patient object that is structurally identical but a different
 *  reference — simulating what fetchPatients() / a WS handler produces. */
function refreshedPatient(p: SickBayPatient): SickBayPatient {
  return { ...p, updatedAt: new Date().toISOString() };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PatientCard editor — focus and draft stability on parent re-render', () => {
  it('complaint editor: typed value and focus survive a parent re-render', () => {
    const patient = makePatient();
    const { rerender } = render(<PatientCard {...defaultProps(patient)} />);

    // Open the complaint editor
    fireEvent.click(screen.getByTestId('complaint-editor-toggle-pat-focus-1'));

    const input = screen.getByPlaceholderText('F.eks. Smerter i brystet') as HTMLInputElement;

    // User types a new complaint
    fireEvent.change(input, { target: { value: 'Brystsmerter, tungpust' } });
    expect(input.value).toBe('Brystsmerter, tungpust');

    input.focus();
    expect(document.activeElement).toBe(input);

    // Parent re-renders with a new object reference but identical field values
    rerender(<PatientCard {...defaultProps(refreshedPatient(patient))} />);

    // Draft and focus must be unchanged
    const sameInput = screen.getByPlaceholderText('F.eks. Smerter i brystet') as HTMLInputElement;
    expect(sameInput.value).toBe('Brystsmerter, tungpust');
    expect(document.activeElement).toBe(sameInput);
  });

  it('complaint editor: re-opening initialises draft from the latest patient prop', () => {
    const patient = makePatient({ presentingComplaint: 'Opprinnelig klage' });
    const { rerender } = render(<PatientCard {...defaultProps(patient)} />);

    // Open → type → close (without saving)
    fireEvent.click(screen.getByTestId('complaint-editor-toggle-pat-focus-1'));
    const input = screen.getByPlaceholderText('F.eks. Smerter i brystet') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Ufullstendig innskriving' } });
    fireEvent.click(screen.getByTestId('complaint-editor-toggle-pat-focus-1')); // close

    // Server returns an updated complaint (e.g. another user edited it)
    const updatedPatient = { ...patient, presentingComplaint: 'Oppdatert klage' };
    rerender(<PatientCard {...defaultProps(updatedPatient)} />);

    // Re-open — should show the server value, not the abandoned draft
    fireEvent.click(screen.getByTestId('complaint-editor-toggle-pat-focus-1'));
    const freshInput = screen.getByPlaceholderText('F.eks. Smerter i brystet') as HTMLInputElement;
    expect(freshInput.value).toBe('Oppdatert klage');
  });

  it('demographics editor: typed fullName and focus survive a parent re-render', () => {
    const patient = makePatient();
    const { rerender } = render(<PatientCard {...defaultProps(patient)} />);

    // Open the demographics editor
    fireEvent.click(screen.getByTestId('demographics-editor-toggle-pat-focus-1'));

    const input = screen.getByPlaceholderText('Fornavn Etternavn') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Kari Nordmann' } });
    expect(input.value).toBe('Kari Nordmann');

    input.focus();
    expect(document.activeElement).toBe(input);

    // Parent re-renders with a new object reference (e.g. vitals pushed via WS)
    rerender(<PatientCard {...defaultProps(refreshedPatient(patient))} />);

    const sameInput = screen.getByPlaceholderText('Fornavn Etternavn') as HTMLInputElement;
    expect(sameInput.value).toBe('Kari Nordmann');
    expect(document.activeElement).toBe(sameInput);
  });

  it('placement editor: typed number and focus survive a parent re-render', () => {
    const patient = makePatient();
    const { rerender } = render(<PatientCard {...defaultProps(patient)} />);

    // Open the placement editor
    fireEvent.click(screen.getByText('Oppdater plassering'));

    const input = screen.getByPlaceholderText('F.eks. 12') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '7' } });
    expect(input.value).toBe('7');

    input.focus();
    expect(document.activeElement).toBe(input);

    // Parent re-renders (e.g. after unrelated vitals update)
    rerender(<PatientCard {...defaultProps(refreshedPatient(patient))} />);

    const sameInput = screen.getByPlaceholderText('F.eks. 12') as HTMLInputElement;
    expect(sameInput.value).toBe('7');
    expect(document.activeElement).toBe(sameInput);
  });
});
