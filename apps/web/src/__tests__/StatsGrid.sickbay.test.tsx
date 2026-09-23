/**
 * StatsGrid — "Sykestue" tile (gap B6 / item 8.30).
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatsGrid } from '../pages/Coordinator/StatsGrid';

const STATS = {
  totalPatients: 5,
  patientsIncoming: 1,
  patientsInTreatment: 2,
  patientsObservation: 1,
  discharged: 1,
  transferred: 0,
};

describe('StatsGrid — Sykestue tile (gap B6 / item 8.30)', () => {
  it('says "Kapasitet ikke satt" when there is no capacity, and never invents a number', () => {
    render(<StatsGrid stats={STATS} sickbaySettings={null} patients={[]} />);
    expect(screen.getByTestId('stats-sickbay-tile')).toHaveTextContent('Kapasitet ikke satt');
  });

  it('shows occupied/capacity for chairs and beds from open patients’ placements', () => {
    render(
      <StatsGrid
        stats={STATS}
        sickbaySettings={{ chairs: 16, beds: 4 }}
        patients={[
          { status: 'in_treatment', placementType: 'chair' },
          { status: 'observation', placementType: 'chair' },
          { status: 'in_treatment', placementType: 'bed' },
          // Closed — must not count as occupied.
          { status: 'discharged', placementType: 'chair' },
          // No placement — must not count either.
          { status: 'incoming', placementType: null },
        ]}
      />,
    );
    const tile = screen.getByTestId('stats-sickbay-tile');
    expect(tile).toHaveTextContent('2/16');
    expect(tile).toHaveTextContent('1/4 senger');
  });

  it('renders chairs-only capacity without a beds line when beds is not set', () => {
    render(<StatsGrid stats={STATS} sickbaySettings={{ chairs: 10 }} patients={[]} />);
    const tile = screen.getByTestId('stats-sickbay-tile');
    expect(tile).toHaveTextContent('0/10');
    expect(tile).not.toHaveTextContent('senger');
  });
});
