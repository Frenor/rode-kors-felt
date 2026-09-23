/**
 * IncomingCriticalPanel — who is coming in, and what a screen reader hears.
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { IncomingCriticalPanel } from '../pages/SickBay/IncomingCriticalPanel';
import type { SickbayIncomingItem, TeamPatientEngagement } from '../lib/types';

function item(overrides: Partial<SickbayIncomingItem>): SickbayIncomingItem {
  return {
    patientId: 'p1',
    label: 'Bevisstløs ved mål',
    triageStatus: 'red',
    teamId: null,
    critical: true,
    criticalReasons: ['triage_red'],
    latestVitals: null,
    news2: null,
    updatedAt: '2026-09-23T12:00:00Z',
    ...overrides,
  };
}

const ENGAGEMENTS: Record<string, TeamPatientEngagement[]> = {
  p1: [{ teamId: 't-bravo', teamName: 'Bravo', patientId: 'p1', status: 'transporting' }],
};

describe('IncomingCriticalPanel', () => {
  it('shows which patrol is bringing the patient in', () => {
    render(
      <IncomingCriticalPanel items={[item({})]} engagements={ENGAGEMENTS} onStartTreatment={vi.fn()} onAssignPlacement={vi.fn()} />,
    );
    expect(within(screen.getByTestId('field-engagement-p1')).getByText('Bravo · Transporterer')).toBeInTheDocument();
  });

  it('announces only patients that arrive after the first render', () => {
    const { rerender } = render(
      <IncomingCriticalPanel items={[item({})]} onStartTreatment={vi.fn()} onAssignPlacement={vi.fn()} />,
    );
    // Everything already on screen is not read out again.
    expect(screen.getByTestId('sickbay-critical-announcer')).toHaveTextContent('');

    // A refetch with the same patient stays silent.
    rerender(<IncomingCriticalPanel items={[item({ updatedAt: '2026-09-23T12:01:00Z' })]} onStartTreatment={vi.fn()} onAssignPlacement={vi.fn()} />);
    expect(screen.getByTestId('sickbay-critical-announcer')).toHaveTextContent('');

    // A new patient is announced once, by name.
    rerender(
      <IncomingCriticalPanel
        items={[item({}), item({ patientId: 'p2', label: 'Brystsmerter, km 8' })]}
        onStartTreatment={vi.fn()}
        onAssignPlacement={vi.fn()}
      />,
    );
    expect(screen.getByTestId('sickbay-critical-announcer')).toHaveTextContent('Ny kritisk innkommende: Brystsmerter, km 8');
    expect(screen.getByTestId('sickbay-critical-banner')).not.toHaveAttribute('role', 'alert');
  });
});
