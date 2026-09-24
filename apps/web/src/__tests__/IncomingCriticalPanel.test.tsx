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

  it('shows the shared patient number on the row', () => {
    render(
      <IncomingCriticalPanel items={[item({ seq: 12 })]} onStartTreatment={vi.fn()} onAssignPlacement={vi.fn()} />,
    );
    expect(screen.getByTestId('patient-number-p1')).toHaveTextContent('#12');
  });

  it('renders no number pill when seq is not yet known', () => {
    render(
      <IncomingCriticalPanel items={[item({ seq: null })]} onStartTreatment={vi.fn()} onAssignPlacement={vi.fn()} />,
    );
    expect(screen.queryByTestId('patient-number-p1')).not.toBeInTheDocument();
  });

  it('shows the "AMK varslet" pill once amkNotifiedAt is set', () => {
    render(
      <IncomingCriticalPanel
        items={[item({ amkNotifiedAt: '2026-09-23T11:40:00Z' })]}
        onStartTreatment={vi.fn()}
        onAssignPlacement={vi.fn()}
      />,
    );
    expect(screen.getByTestId('amk-notified-pill-p1')).toHaveTextContent(/^AMK varslet kl\. \d{2}:\d{2}$/);
  });

  it('renders no AMK pill before AMK has been notified', () => {
    render(<IncomingCriticalPanel items={[item({})]} onStartTreatment={vi.fn()} onAssignPlacement={vi.fn()} />);
    expect(screen.queryByTestId('amk-notified-pill-p1')).not.toBeInTheDocument();
  });
});
