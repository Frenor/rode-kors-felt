/**
 * PatientCard — triage editor in "Rediger detaljer" (gap A2).
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PatientCard } from '../pages/SickBay/PatientCard';
import type { SickBayPatient } from '../lib/types';

function makePatient(overrides: Partial<SickBayPatient> = {}): SickBayPatient {
  return {
    id: 'pat-triage-1',
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

function openTriageEditor(patient: SickBayPatient, onUpdateTriage: (t: string | null) => void) {
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
      onUpdateTriage={onUpdateTriage}
    />,
  );
  fireEvent.click(screen.getByTestId('edit-details-toggle-pat-triage-1'));
  fireEvent.click(screen.getByTestId('triage-editor-toggle-pat-triage-1'));
}

describe('PatientCard — triage editor', () => {
  it('shows all four triage chips plus "Fjern triage"', () => {
    openTriageEditor(makePatient(), NOOP);
    const panel = screen.getByTestId('triage-editor-pat-triage-1');
    expect(panel).toHaveTextContent('Grønn');
    expect(panel).toHaveTextContent('Gul');
    expect(panel).toHaveTextContent('Rød');
    expect(panel).toHaveTextContent('Svart');
    expect(screen.getByTestId('triage-clear-pat-triage-1')).toBeInTheDocument();
  });

  it('calls onUpdateTriage with the chosen colour and closes the editor', () => {
    const onUpdateTriage = vi.fn();
    openTriageEditor(makePatient({ triageStatus: 'yellow' }), onUpdateTriage);

    fireEvent.click(screen.getByTestId('triage-chip-pat-triage-1-red'));

    expect(onUpdateTriage).toHaveBeenCalledWith('red');
    expect(screen.queryByTestId('triage-editor-pat-triage-1')).not.toBeInTheDocument();
  });

  it('"Fjern triage" calls onUpdateTriage with null and is disabled without a current triage', () => {
    const onUpdateTriage = vi.fn();
    openTriageEditor(makePatient({ triageStatus: null }), onUpdateTriage);
    expect(screen.getByTestId('triage-clear-pat-triage-1')).toBeDisabled();

    fireEvent.click(screen.getByTestId('triage-editor-toggle-pat-triage-1')); // close
    fireEvent.click(screen.getByTestId('triage-editor-toggle-pat-triage-1')); // reopen (state unaffected)
  });

  it('"Fjern triage" is enabled and clears an existing triage', () => {
    const onUpdateTriage = vi.fn();
    openTriageEditor(makePatient({ triageStatus: 'green' }), onUpdateTriage);

    const clearButton = screen.getByTestId('triage-clear-pat-triage-1');
    expect(clearButton).not.toBeDisabled();
    fireEvent.click(clearButton);

    expect(onUpdateTriage).toHaveBeenCalledWith(null);
  });

  it('marks the current triage chip as pressed', () => {
    openTriageEditor(makePatient({ triageStatus: 'black' }), NOOP);
    expect(screen.getByTestId('triage-chip-pat-triage-1-black')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('triage-chip-pat-triage-1-green')).toHaveAttribute('aria-pressed', 'false');
  });
});
