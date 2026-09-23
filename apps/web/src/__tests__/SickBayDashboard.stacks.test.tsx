/**
 * SickBayDashboard — "Innkommende" split into "På vei" / "Venter i teltet" (gap A9),
 * the "på vei" distance line (gap A7), and the intake toast naming the patient number (gap A5).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { SickBayDashboard } from '../pages/SickBayDashboard';

vi.mock('../stores/auth', () => ({
  useAuthStore: vi.fn(() => ({ eventId: 'evt-test' })),
}));

const mockAddToast = vi.fn();
vi.mock('../stores/notifications', () => ({
  useNotificationStore: vi.fn((selector?: (state: { add: typeof mockAddToast }) => unknown) => {
    const state = { add: mockAddToast };
    return selector ? selector(state) : state;
  }),
}));

type WsHandler = (msg: Record<string, unknown>) => void;
const wsState = {
  onMessage: vi.fn((_handler: WsHandler) => () => {}),
  send: vi.fn(),
};
vi.mock('../stores/ws', () => ({
  useWsStore: vi.fn((selector?: (state: typeof wsState) => unknown) =>
    selector ? selector(wsState) : wsState,
  ),
}));

const mockAlphaTeam = {
  id: 'team-alpha',
  name: 'Alpha',
  transport: 'foot',
  currentPosition: { lat: 59.9645, lng: 10.666 },
};

vi.mock('../lib/api', () => ({
  api: {
    getPatients: vi.fn(),
    getSickbayIncoming: vi.fn().mockResolvedValue({ items: [] }),
    getTeamPatientEngagements: vi.fn().mockResolvedValue({ engagements: {} }),
    getEvent: vi.fn().mockResolvedValue({ event: {}, teams: [] }),
    executePatientAction: vi.fn().mockResolvedValue({ patient: {}, action: { id: 'a1' } }),
    addPatientNote: vi.fn().mockResolvedValue({ patient: {} }),
    createPatient: vi.fn(),
    updatePatient: vi.fn().mockResolvedValue({ patient: {} }),
    recordVitals: vi.fn(),
    recordMedication: vi.fn(),
    getMedications: vi.fn().mockResolvedValue({ medications: [] }),
    getAmkCallLogs: vi.fn().mockResolvedValue({ callLogs: [] }),
    undoAction: vi.fn(),
  },
}));

import { api } from '../lib/api';

function makePatient(overrides: Record<string, unknown> = {}) {
  return {
    id: 'pat-1',
    eventId: 'evt-test',
    status: 'incoming',
    ageGroup: 'adult',
    presentingComplaint: 'Test',
    assignedClinician: null,
    notes: [],
    actionHistory: [],
    latestVitals: null,
    vitalsHistory: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('SickBayDashboard — stack split rule', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.getSickbayIncoming).mockResolvedValue({ items: [] });
    vi.mocked(api.getEvent).mockResolvedValue({ event: {}, teams: [mockAlphaTeam] });
  });

  it('puts an engaged patient in "På vei" and everyone else in "Venter i teltet"', async () => {
    vi.mocked(api.getPatients).mockResolvedValue({
      patients: [
        makePatient({ id: 'sofia', fullName: 'Sofia Nilsen', lat: 59.961, lon: 10.6718 }),
        makePatient({ id: 'walkin', fullName: 'Walk-in' }),
      ],
    });
    vi.mocked(api.getTeamPatientEngagements).mockResolvedValue({
      engagements: {
        sofia: [{ teamId: 'team-alpha', teamName: 'Alpha', patientId: 'sofia', status: 'en_route_to_patient' }],
      },
    });

    render(<SickBayDashboard />);
    await screen.findByTestId('sickbay-stack-on-the-way');

    const onTheWay = screen.getByTestId('sickbay-stack-on-the-way');
    expect(within(onTheWay).getByText('Sofia Nilsen')).toBeInTheDocument();

    const waiting = screen.getByTestId('sickbay-stack-waiting');
    expect(within(waiting).getByText('Walk-in')).toBeInTheDocument();
    expect(within(waiting).queryByText('Sofia Nilsen')).not.toBeInTheDocument();
  });

  it('shows a measured distance and transport mode once both positions are known', async () => {
    vi.mocked(api.getPatients).mockResolvedValue({
      patients: [makePatient({ id: 'sofia', fullName: 'Sofia Nilsen', lat: 59.961, lon: 10.6718 })],
    });
    vi.mocked(api.getTeamPatientEngagements).mockResolvedValue({
      engagements: {
        sofia: [{ teamId: 'team-alpha', teamName: 'Alpha', patientId: 'sofia', status: 'en_route_to_patient' }],
      },
    });

    render(<SickBayDashboard />);
    const line = await screen.findByTestId('field-engagement-sofia');
    expect(line).toHaveTextContent('Alpha · På vei');
    expect(line).toHaveTextContent(/unna · til fots/);
  });

  it('renders only "Venter i teltet" when no patrol is on the way', async () => {
    vi.mocked(api.getPatients).mockResolvedValue({ patients: [makePatient({ id: 'walkin', fullName: 'Walk-in' })] });

    render(<SickBayDashboard />);
    await screen.findByTestId('sickbay-stack-waiting');
    expect(screen.queryByTestId('sickbay-stack-on-the-way')).not.toBeInTheDocument();
  });

  it('keeps a handed-over patient visible, waiting, with its hand-over line', async () => {
    vi.mocked(api.getPatients).mockResolvedValue({
      patients: [
        makePatient({
          id: 'handed',
          fullName: 'Per Hansen',
          handedOverAt: '2026-09-23T11:52:00Z',
          handedOverByTeamId: 'team-alpha',
        }),
      ],
    });

    render(<SickBayDashboard />);
    const waiting = await screen.findByTestId('sickbay-stack-waiting');
    expect(within(waiting).getByTestId('handover-line-handed')).toHaveTextContent(/^Overlevert av Alpha kl\. \d{2}:\d{2}$/);
  });
});

describe('SickBayDashboard — intake success toast names the patient number', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.getPatients).mockResolvedValue({ patients: [] });
    vi.mocked(api.getSickbayIncoming).mockResolvedValue({ items: [] });
    vi.mocked(api.getEvent).mockResolvedValue({ event: {}, teams: [] });
  });

  it('shows "Pasient #<n> registrert" once the server assigns a number', async () => {
    vi.mocked(api.createPatient).mockResolvedValue({ patient: makePatient({ id: 'new', seq: 6 }) });

    render(<SickBayDashboard />);
    await screen.findByText('Sykestue');
    fireEvent.click(screen.getByRole('button', { name: 'Ny pasient' }));
    const dialog = await screen.findByRole('dialog', { name: 'Registrer ny pasient' });
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Problemstilling' }), {
      target: { value: 'Brystsmerter' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Registrer' }));

    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith(expect.objectContaining({ message: 'Pasient #6 registrert' }));
    });
  });

  it('falls back to a generic message when the create response carries no number', async () => {
    vi.mocked(api.createPatient).mockResolvedValue({ patient: makePatient({ id: 'new', seq: null }) });

    render(<SickBayDashboard />);
    await screen.findByText('Sykestue');
    fireEvent.click(screen.getByRole('button', { name: 'Ny pasient' }));
    const dialog = await screen.findByRole('dialog', { name: 'Registrer ny pasient' });
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Problemstilling' }), {
      target: { value: 'Brystsmerter' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Registrer' }));

    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith(expect.objectContaining({ message: 'Pasient registrert' }));
    });
  });
});
