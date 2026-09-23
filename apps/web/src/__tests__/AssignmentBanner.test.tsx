import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { AssignmentBanner } from '../pages/FirstAider/AssignmentBanner';

describe('AssignmentBanner (gap A4)', () => {
  it('shows the patient number and label', () => {
    render(
      <AssignmentBanner
        patient={{ id: 'pat-5', label: 'Bevisstløs person ved løypebok', seq: 12 }}
        onAccept={vi.fn()}
        onDecline={vi.fn()}
      />,
    );
    expect(screen.getByTestId('firstaid-assignment-banner-pat-5')).toHaveTextContent(
      'Koordinator har tildelt dere: #12 Bevisstløs person ved løypebok',
    );
  });

  it('renders without a number when seq is unknown', () => {
    render(<AssignmentBanner patient={{ id: 'pat-5', label: 'Ukjent pasient' }} onAccept={vi.fn()} onDecline={vi.fn()} />);
    expect(screen.getByTestId('firstaid-assignment-banner-pat-5')).toHaveTextContent(
      'Koordinator har tildelt dere: Ukjent pasient',
    );
  });

  it('"Vi drar" calls onAccept with the patient id', () => {
    const onAccept = vi.fn();
    render(<AssignmentBanner patient={{ id: 'pat-5', label: 'X' }} onAccept={onAccept} onDecline={vi.fn()} />);
    fireEvent.click(screen.getByText('Vi drar'));
    expect(onAccept).toHaveBeenCalledWith('pat-5');
  });

  it('"Kan ikke" calls onDecline with the patient id', () => {
    const onDecline = vi.fn();
    render(<AssignmentBanner patient={{ id: 'pat-5', label: 'X' }} onAccept={vi.fn()} onDecline={onDecline} />);
    fireEvent.click(screen.getByText('Kan ikke'));
    expect(onDecline).toHaveBeenCalledWith('pat-5');
  });
});
