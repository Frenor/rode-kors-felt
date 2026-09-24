/**
 * PatientIntakeModal — an intake needs a name or a complaint.
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PatientIntakeModal, isIntakeFormValid, type IntakeFormShape } from '../pages/SickBay/PatientIntakeModal';

const EMPTY: IntakeFormShape = {
  fullName: '',
  gender: '',
  birthDate: '',
  placementType: '',
  placementNumber: '',
  ageGroup: 'adult',
  presentingComplaint: '',
  assignedClinician: '',
};

describe('PatientIntakeModal validation', () => {
  it('rejects an empty form and accepts a name or a complaint', () => {
    expect(isIntakeFormValid(EMPTY)).toBe(false);
    expect(isIntakeFormValid({ ...EMPTY, fullName: '  ' })).toBe(false);
    expect(isIntakeFormValid({ ...EMPTY, fullName: 'Ola' })).toBe(true);
    expect(isIntakeFormValid({ ...EMPTY, presentingComplaint: 'Brystsmerter' })).toBe(true);
  });

  it('disables Registrer and explains why while the form is empty', () => {
    render(<PatientIntakeModal form={EMPTY} onChange={vi.fn()} onSubmit={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Registrer' })).toBeDisabled();
    expect(screen.getByTestId('intake-validation-hint')).toBeInTheDocument();
  });

  it('enables Registrer once a complaint is typed', () => {
    render(
      <PatientIntakeModal
        form={{ ...EMPTY, presentingComplaint: 'Ankelskade' }}
        onChange={vi.fn()}
        onSubmit={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Registrer' })).toBeEnabled();
    expect(screen.queryByTestId('intake-validation-hint')).not.toBeInTheDocument();
  });
});
