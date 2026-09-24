import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { QuickLogSheet } from '../pages/FirstAider/QuickLogSheet';
import type { GeolocationState } from '../hooks/useGeolocation';

const NO_GPS: GeolocationState = { position: null, status: 'unavailable', accuracy: null, updatedAt: null };
const WITH_GPS: GeolocationState = { position: { lat: 59.96, lng: 10.67 }, status: 'ok', accuracy: 8, updatedAt: Date.now() };

describe('QuickLogSheet (gap A8 / item 8.28)', () => {
  it('green triage is preselected', () => {
    render(<QuickLogSheet gps={NO_GPS} initialPositionText="" submitting={false} error="" onSubmit={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByTestId('firstaid-quick-log-triage-green')).toHaveAttribute('aria-checked', 'true');
  });

  it('submit is disabled until a complaint is picked', () => {
    render(<QuickLogSheet gps={NO_GPS} initialPositionText="" submitting={false} error="" onSubmit={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByTestId('firstaid-quick-log-submit')).toBeDisabled();
    fireEvent.click(screen.getByTestId('firstaid-quick-log-complaint-blister'));
    expect(screen.getByTestId('firstaid-quick-log-submit')).not.toBeDisabled();
  });

  it('"Annet" requires typed text before it can submit', () => {
    render(<QuickLogSheet gps={NO_GPS} initialPositionText="" submitting={false} error="" onSubmit={vi.fn()} onClose={vi.fn()} />);
    fireEvent.click(screen.getByTestId('firstaid-quick-log-complaint-other'));
    expect(screen.getByTestId('firstaid-quick-log-submit')).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Beskriv hva det gjelder'), { target: { value: 'Insektstikk' } });
    expect(screen.getByTestId('firstaid-quick-log-submit')).not.toBeDisabled();
  });

  it('submits the expected payload for a picked complaint chip', () => {
    const onSubmit = vi.fn();
    render(<QuickLogSheet gps={WITH_GPS} initialPositionText="Sektor B" submitting={false} error="" onSubmit={onSubmit} onClose={vi.fn()} />);
    fireEvent.click(screen.getByTestId('firstaid-quick-log-complaint-blister'));
    fireEvent.change(screen.getByLabelText('Notat (valgfritt)'), { target: { value: 'Plaster satt på' } });
    fireEvent.click(screen.getByTestId('firstaid-quick-log-submit'));
    expect(onSubmit).toHaveBeenCalledWith({
      label: 'Gnagsår',
      triageStatus: 'green',
      description: 'Plaster satt på',
      positionText: 'Sektor B',
      lat: 59.96,
      lon: 10.67,
      ageGroup: 'adult',
    });
  });

  it('uses the typed "Annet" text as the label instead of the chip label', () => {
    const onSubmit = vi.fn();
    render(<QuickLogSheet gps={NO_GPS} initialPositionText="" submitting={false} error="" onSubmit={onSubmit} onClose={vi.fn()} />);
    fireEvent.click(screen.getByTestId('firstaid-quick-log-complaint-other'));
    fireEvent.change(screen.getByLabelText('Beskriv hva det gjelder'), { target: { value: 'Insektstikk' } });
    fireEvent.click(screen.getByTestId('firstaid-quick-log-submit'));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ label: 'Insektstikk', lat: null, lon: null }));
  });

  it('shows a passed-in error line', () => {
    render(<QuickLogSheet gps={NO_GPS} initialPositionText="" submitting={false} error="Kunne ikke loggføre — prøv igjen." onSubmit={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Kunne ikke loggføre');
  });
});
