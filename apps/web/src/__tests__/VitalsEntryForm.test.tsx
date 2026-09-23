/**
 * VitalsEntryForm — live NEWS2 preview while typing.
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EMPTY_VITALS_FORM, VitalsEntryForm, vitalsFormToNews2Input } from '../pages/SickBay/VitalsEntryForm';

describe('VitalsEntryForm live NEWS2 preview', () => {
  it('shows nothing until a scored parameter is typed', () => {
    render(<VitalsEntryForm patientId="p1" form={EMPTY_VITALS_FORM} onChange={vi.fn()} onSubmit={vi.fn()} />);
    expect(screen.queryByTestId('news2-preview-p1')).not.toBeInTheDocument();
  });

  it('previews the score, level, interval and missing parameters', () => {
    render(
      <VitalsEntryForm
        patientId="p1"
        form={{ ...EMPTY_VITALS_FORM, pulse: '115', spo2: '93', rr: '23' }}
        onChange={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );
    const preview = screen.getByTestId('news2-preview-p1');
    expect(preview).toHaveTextContent('NEWS2 foreløpig: 6 · middels');
    expect(preview).toHaveTextContent('Ny vurdering om 1 time');
    expect(preview).toHaveTextContent('mangler BT, ACVPU, Temp');
  });

  it('converts the form to a NEWS2 input, accepting a decimal comma', () => {
    expect(vitalsFormToNews2Input({ ...EMPTY_VITALS_FORM, temp: '38,4', acvpu: 'voice' })).toEqual({
      pulse: undefined,
      spo2: undefined,
      respiratoryRate: undefined,
      systolicBP: undefined,
      temperature: 38.4,
      acvpu: 'voice',
    });
  });
});
