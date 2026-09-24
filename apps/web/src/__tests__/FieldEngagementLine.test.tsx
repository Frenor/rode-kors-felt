/**
 * FieldEngagementLine — the "på vei" distance line (gap A7/A9).
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FieldEngagementLine, engagementDistanceLabel } from '../pages/SickBay/FieldEngagementLine';
import type { Team, TeamPatientEngagement } from '../lib/types';

const ALPHA: Team = {
  id: 'team-alpha',
  name: 'Alpha',
  transport: 'foot',
  currentPosition: { lat: 59.9645, lng: 10.666 },
};

const enRoute = (teamId = 'team-alpha'): TeamPatientEngagement[] => [
  { teamId, teamName: 'Alpha', patientId: 'p1', status: 'en_route_to_patient' },
];

describe('engagementDistanceLabel', () => {
  it('returns null when the patient position is unknown', () => {
    expect(engagementDistanceLabel(enRoute(), [ALPHA], { lat: null, lon: null })).toBeNull();
  });

  it('returns null when no patrol is currently approaching', () => {
    const monitoring: TeamPatientEngagement[] = [
      { teamId: 'team-alpha', teamName: 'Alpha', patientId: 'p1', status: 'monitoring' },
    ];
    expect(engagementDistanceLabel(monitoring, [ALPHA], { lat: 59.961, lon: 10.6718 })).toBeNull();
  });

  it('returns null when the approaching team has no known position', () => {
    const noPosition: Team = { ...ALPHA, currentPosition: null };
    expect(engagementDistanceLabel(enRoute(), [noPosition], { lat: 59.961, lon: 10.6718 })).toBeNull();
  });

  it('formats a measured distance with the team\'s transport mode', () => {
    const label = engagementDistanceLabel(enRoute(), [ALPHA], { lat: 59.961, lon: 10.6718 });
    expect(label).not.toBeNull();
    expect(label).toMatch(/^≈ .+ unna · til fots$/);
  });

  it('omits the transport suffix when the team has no transport set', () => {
    const noTransport: Team = { ...ALPHA, transport: undefined };
    const label = engagementDistanceLabel(enRoute(), [noTransport], { lat: 59.961, lon: 10.6718 });
    expect(label).toMatch(/^≈ .+ unna$/);
  });
});

describe('FieldEngagementLine', () => {
  it('keeps the pill text intact and appends the distance as a separate line', () => {
    render(
      <FieldEngagementLine
        patientId="demo-pat-4"
        engagements={enRoute()}
        distanceLabel="≈ 500 m unna · til fots"
      />,
    );
    const line = screen.getByTestId('field-engagement-demo-pat-4');
    expect(line).toHaveTextContent('Alpha · På vei');
    expect(line).toHaveTextContent('≈ 500 m unna · til fots');
  });

  it('renders nothing extra when there is no distance to show', () => {
    render(<FieldEngagementLine patientId="p1" engagements={enRoute()} />);
    const line = screen.getByTestId('field-engagement-p1');
    expect(line).toHaveTextContent('Alpha · På vei');
    expect(line.textContent).toBe('Alpha · På vei');
  });
});
