import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { TransportRequestSheet } from '../pages/FirstAider/TransportRequestSheet';

describe('TransportRequestSheet (gap B3 / item 8.26)', () => {
  it('renders the three need chips and prefills the pickup text', () => {
    render(<TransportRequestSheet initialPickupText="Ved kiosken" onSend={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByTestId('firstaid-transport-need-stretcher')).toHaveTextContent('Båre');
    expect(screen.getByTestId('firstaid-transport-need-atv')).toHaveTextContent('ATV');
    expect(screen.getByTestId('firstaid-transport-need-ambulance')).toHaveTextContent('Ambulanse');
    expect(screen.getByLabelText('Hentested')).toHaveValue('Ved kiosken');
  });

  it('disables Send until a need chip is picked', () => {
    render(<TransportRequestSheet initialPickupText="" onSend={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByTestId('firstaid-transport-sheet-send')).toBeDisabled();
    fireEvent.click(screen.getByTestId('firstaid-transport-need-atv'));
    expect(screen.getByTestId('firstaid-transport-sheet-send')).not.toBeDisabled();
  });

  it('Send calls onSend with the picked need and the (possibly edited) pickup text', () => {
    const onSend = vi.fn();
    render(<TransportRequestSheet initialPickupText="Sektor B" onSend={onSend} onClose={vi.fn()} />);
    fireEvent.click(screen.getByTestId('firstaid-transport-need-atv'));
    fireEvent.change(screen.getByLabelText('Hentested'), { target: { value: 'Km 12' } });
    fireEvent.click(screen.getByTestId('firstaid-transport-sheet-send'));
    expect(onSend).toHaveBeenCalledWith('atv', 'Km 12');
  });

  it('Avbryt calls onClose without sending', () => {
    const onSend = vi.fn();
    const onClose = vi.fn();
    render(<TransportRequestSheet initialPickupText="" onSend={onSend} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Avbryt' }));
    expect(onClose).toHaveBeenCalled();
    expect(onSend).not.toHaveBeenCalled();
  });

  it('clicking the backdrop also dismisses the sheet', () => {
    const onClose = vi.fn();
    render(<TransportRequestSheet initialPickupText="" onSend={vi.fn()} onClose={onClose} />);
    fireEvent.click(screen.getByRole('dialog', { name: 'Be om transport' }));
    expect(onClose).toHaveBeenCalled();
  });
});
