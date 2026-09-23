/**
 * EventSetupPage — event set-up (gap B5 / item 8.31), wired to a mocked api.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { EventSetupPage } from '../pages/Coordinator/EventSetupPage';

vi.mock('qrcode', () => ({
  toCanvas: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../stores/auth', () => ({
  useAuthStore: vi.fn(() => ({ eventId: 'evt-test' })),
}));

vi.mock('../lib/api', () => ({
  api: {
    getEvent: vi.fn(),
    getAccessCodes: vi.fn(),
    updateEvent: vi.fn(),
    updateEventSettings: vi.fn(),
    createTeam: vi.fn(),
    updateTeam: vi.fn(),
    createAccessCode: vi.fn(),
    revokeAccessCode: vi.fn(),
    getEventJournals: vi.fn(),
    anonymiseEvent: vi.fn(),
  },
}));

import { api } from '../lib/api';

const EVENT = {
  id: 'evt-test',
  name: 'Holmenkollen Skimaraton 2026',
  startDate: '2026-09-23T08:00:00Z',
  endDate: '2026-09-23T18:00:00Z',
  status: 'active' as const,
  settings: { sickbay: { chairs: 16, beds: 4 } },
  anonymisedAt: null,
};

const TEAMS = [{ id: 't-alpha', name: 'Alpha', transport: 'foot', contactPhone: null, contactRadio: null, active: true }];

function renderPage() {
  return render(
    <MemoryRouter>
      <EventSetupPage />
    </MemoryRouter>,
  );
}

describe('EventSetupPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.getEvent).mockResolvedValue({ event: EVENT, teams: TEAMS });
    vi.mocked(api.getAccessCodes).mockResolvedValue({ codes: [] });
  });

  it('loads the event with inactive teams included, and fills the Arrangement form', async () => {
    renderPage();
    await waitFor(() => expect(api.getEvent).toHaveBeenCalledWith('evt-test', { includeInactive: true }));
    expect(await screen.findByTestId('event-setup-name')).toHaveValue('Holmenkollen Skimaraton 2026');
    expect(screen.getByTestId('event-setup-capacity-chairs')).toHaveValue(16);
  });

  it('says "Kapasitet ikke satt" is not invented — capacity input stays blank without settings', async () => {
    vi.mocked(api.getEvent).mockResolvedValue({ event: { ...EVENT, settings: undefined }, teams: TEAMS });
    renderPage();
    await screen.findByTestId('event-setup-name');
    expect(screen.getByTestId('event-setup-capacity-chairs')).toHaveValue(null);
  });

  it('creates an access code through the api and shows it once', async () => {
    vi.mocked(api.createAccessCode).mockResolvedValue({ code: { id: 'code-1', role: 'first_aider', code: '482913', expiresAt: '2026-09-24T00:00:00Z', revokedAt: null } });
    renderPage();
    await screen.findByTestId('event-setup-name');

    fireEvent.click(screen.getByTestId('event-setup-code-create'));
    await waitFor(() => expect(api.createAccessCode).toHaveBeenCalledWith('evt-test', { role: 'first_aider', hours: 24 }));
    expect(await screen.findByTestId('event-setup-code-value')).toHaveTextContent('482913');
  });

  it('revokes an access code through the api', async () => {
    vi.mocked(api.getAccessCodes).mockResolvedValue({
      codes: [{ id: 'code-1', role: 'sickbay', code: '111111', expiresAt: '2026-09-24T00:00:00Z', revokedAt: null }],
    });
    vi.mocked(api.revokeAccessCode).mockResolvedValue({ code: { id: 'code-1', role: 'sickbay', code: '111111', expiresAt: '2026-09-24T00:00:00Z', revokedAt: '2026-09-23T12:00:00Z' } });
    renderPage();
    await screen.findByTestId('event-setup-name');

    fireEvent.click(await screen.findByTestId('event-setup-code-revoke-code-1'));
    await waitFor(() => expect(api.revokeAccessCode).toHaveBeenCalledWith('code-1'));
    expect(await screen.findByText('Trukket tilbake')).toBeInTheDocument();
  });

  it('saves the Arrangement form via updateEvent', async () => {
    vi.mocked(api.updateEvent).mockResolvedValue({ event: { ...EVENT, name: 'Ny tittel' } });
    renderPage();
    const nameInput = await screen.findByTestId('event-setup-name');
    fireEvent.change(nameInput, { target: { value: 'Ny tittel' } });
    fireEvent.click(screen.getByRole('button', { name: /^Lagre$/ }));
    await waitFor(() => expect(api.updateEvent).toHaveBeenCalledWith('evt-test', expect.objectContaining({ name: 'Ny tittel', status: 'active' })));
  });

  it('saves sick bay capacity via updateEventSettings', async () => {
    vi.mocked(api.updateEventSettings).mockResolvedValue({ settings: { sickbay: { chairs: 20, beds: 4 } } });
    renderPage();
    const chairsInput = await screen.findByTestId('event-setup-capacity-chairs');
    fireEvent.change(chairsInput, { target: { value: '20' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lagre kapasitet' }));
    await waitFor(() => expect(api.updateEventSettings).toHaveBeenCalledWith('evt-test', { sickbay: { chairs: 20, beds: 4 } }));
  });

  it('shows a visible error line when loading the event fails', async () => {
    vi.mocked(api.getEvent).mockRejectedValue(new Error('Nettverksfeil'));
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent('Nettverksfeil');
  });
});
