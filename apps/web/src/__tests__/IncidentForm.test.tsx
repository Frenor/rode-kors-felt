import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { IncidentForm } from '../pages/IncidentForm';

// Mock the api module
vi.mock('../lib/api', () => ({
  api: {
    createIncident: vi.fn(),
    getEventIndoorLayout: vi.fn(),
  },
}));

// Mock the auth store so useAuthStore returns a predictable eventId
vi.mock('../stores/auth', () => ({
  useAuthStore: vi.fn(() => ({ eventId: 'evt-1' })),
}));

vi.mock('../hooks/useGeolocation', () => ({
  useGeolocation: vi.fn(() => ({
    position: null,
    status: 'idle',
  })),
}));

import { api } from '../lib/api';
import { useGeolocation } from '../hooks/useGeolocation';

function renderForm() {
  return render(
    <MemoryRouter
      initialEntries={[{ pathname: '/firstaid/incident', state: { teamId: 'team-1', eventId: 'evt-1' } }]}
    >
      <Routes>
        <Route path="/firstaid/incident" element={<IncidentForm />} />
        <Route path="/firstaid" element={<div>firstaid home</div>} />
      </Routes>
    </MemoryRouter>
  );
}

function fillStep1NEWS2() {
  fireEvent.click(screen.getByRole('radio', { name: /Voice/i }));
  fireEvent.change(screen.getByLabelText('Pustefrekvens (/min)'), { target: { value: '26' } });
  fireEvent.change(screen.getByLabelText('SpO₂ (%)'), { target: { value: '90' } });
  fireEvent.change(screen.getByLabelText('Puls (bpm)'), { target: { value: '118' } });
}

function getStep1NewsPreview() {
  return screen.getByTestId('incident-news2-preview-step1');
}

beforeEach(() => {
  vi.mocked(api.createIncident).mockReset();
  vi.mocked(api.getEventIndoorLayout).mockResolvedValue({ layout: null });
  vi.mocked(useGeolocation).mockReturnValue({ position: null, status: 'idle' });
});

describe('IncidentForm — step 0 (incident type)', () => {
  it('initially renders step 0 with all incident type buttons', () => {
    renderForm();

    expect(screen.getByRole('button', { name: 'Medisinsk' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Traume' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Psykiatrisk' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Annet' })).toBeInTheDocument();
  });

  it('advances to step 1 when "Medisinsk" is clicked', () => {
    renderForm();
    fireEvent.click(screen.getByRole('button', { name: 'Medisinsk' }));

    // Step 1 heading
    expect(screen.getByRole('heading', { name: 'ABCDE-vurdering' })).toBeInTheDocument();
    // ACVPU fieldset legend
    expect(screen.getByText('D — Bevissthet (ACVPU)')).toBeInTheDocument();
  });
});

describe('IncidentForm — step 1 (AVPU + vitals)', () => {
  function goToStep1() {
    renderForm();
    fireEvent.click(screen.getByRole('button', { name: 'Medisinsk' }));
  }

  it('marks the AVPU button "A" as selected (aria-checked=true) when clicked', () => {
    goToStep1();

    const alertButton = screen.getByRole('radio', { name: /Alert/i });
    expect(alertButton).toHaveAttribute('aria-checked', 'false');

    fireEvent.click(alertButton);

    expect(alertButton).toHaveAttribute('aria-checked', 'true');
  });

  it('returns to step 0 when "← Tilbake" is clicked', () => {
    goToStep1();
    fireEvent.click(screen.getByRole('button', { name: '← Tilbake' }));

    expect(screen.getByRole('button', { name: 'Medisinsk' })).toBeInTheDocument();
  });

  it('advances to step 2 when "Neste: MIST →" is clicked', () => {
    goToStep1();
    fireEvent.click(screen.getByRole('button', { name: 'Neste: MIST →' }));

    // Step 2 shows MIST labels
    expect(screen.getByText(/M — Skademekanisme/)).toBeInTheDocument();
  });

  it('shows live NEWS2 preview while entering vitals', () => {
    goToStep1();

    const preview = getStep1NewsPreview();
    expect(preview).toHaveTextContent('Foreløpig NEWS2');
    expect(preview).toHaveTextContent('Ingen score ennå');

    fillStep1NEWS2();

    expect(preview).toHaveTextContent(/NEWS2 \d+/);
    expect(preview).toHaveTextContent('Mangler: Systolisk blodtrykk, Temperatur');
  });

  it('keeps missing hint hidden until vitals are entered', () => {
    goToStep1();

    const preview = getStep1NewsPreview();
    expect(preview).not.toHaveTextContent('Mangler:');

    fillStep1NEWS2();
    expect(preview).toHaveTextContent('Mangler: Systolisk blodtrykk, Temperatur');
  });
});

describe('IncidentForm — step 2 (MIST)', () => {
  function goToStep2() {
    renderForm();
    fireEvent.click(screen.getByRole('button', { name: 'Medisinsk' }));
    fireEvent.click(screen.getByRole('button', { name: 'Neste: MIST →' }));
  }

  it('shows all four MIST section labels', () => {
    goToStep2();

    expect(screen.getByText(/M — Skademekanisme/)).toBeInTheDocument();
    expect(screen.getByText(/I — Skade/)).toBeInTheDocument();
    expect(screen.getByText(/S — Tegn/)).toBeInTheDocument();
    expect(screen.getByText(/T — Behandling/)).toBeInTheDocument();
  });

  it('prefills MIST tegn chips from selected START-triage tag', () => {
    renderForm();
    fireEvent.click(screen.getByRole('radio', { name: 'UMIDDELBAR' }));
    fireEvent.click(screen.getByRole('button', { name: 'Medisinsk' }));
    fireEvent.click(screen.getByRole('button', { name: 'Neste: MIST →' }));

    expect(screen.getByRole('button', { name: '✓ Pågående blødning' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '✓ Pustevansker' })).toBeInTheDocument();
  });

  it('updates untouched prefill when triage tag changes before user edits', () => {
    renderForm();
    fireEvent.click(screen.getByRole('radio', { name: 'MINDRE' }));
    fireEvent.click(screen.getByRole('radio', { name: 'UMIDDELBAR' }));
    fireEvent.click(screen.getByRole('button', { name: 'Medisinsk' }));
    fireEvent.click(screen.getByRole('button', { name: 'Neste: MIST →' }));

    expect(screen.getByTestId('mist-sign-chip-Pågående blødning')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('mist-sign-chip-Pustevansker')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('mist-sign-chip-Går selv')).toHaveAttribute('aria-pressed', 'false');
  });

  it('does not override user-edited tegn chips when triage tag changes later', () => {
    renderForm();
    fireEvent.click(screen.getByRole('radio', { name: 'MINDRE' }));
    fireEvent.click(screen.getByRole('button', { name: 'Medisinsk' }));
    fireEvent.click(screen.getByRole('button', { name: 'Neste: MIST →' }));

    const dizzinessChip = screen.getByTestId('mist-sign-chip-Svimmelhet');
    fireEvent.click(dizzinessChip);
    expect(dizzinessChip).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(screen.getByRole('button', { name: '← Tilbake' }));
    fireEvent.click(screen.getByRole('button', { name: '← Tilbake' }));
    fireEvent.click(screen.getByRole('radio', { name: 'UMIDDELBAR' }));
    fireEvent.click(screen.getByRole('button', { name: 'Medisinsk' }));
    fireEvent.click(screen.getByRole('button', { name: 'Neste: MIST →' }));

    expect(screen.getByTestId('mist-sign-chip-Svimmelhet')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('mist-sign-chip-Pågående blødning')).toHaveAttribute('aria-pressed', 'false');
  });

  it('carries NEWS2 preview into MIST step with handover guidance', () => {
    renderForm();
    fireEvent.click(screen.getByRole('button', { name: 'Medisinsk' }));
    fillStep1NEWS2();

    const preview = getStep1NewsPreview();
    const badgeText = within(preview).getByText(/NEWS2 \d+/).textContent ?? '';

    fireEvent.click(screen.getByRole('button', { name: 'Neste: MIST →' }));

    const mistPreview = screen.getByTestId('incident-news2-preview-step2');
    expect(mistPreview).toHaveTextContent('NEWS2 i MIST');
    if (badgeText) {
      expect(mistPreview).toHaveTextContent(badgeText);
    }
    expect(mistPreview).toHaveTextContent('hold denne med i overlevering');
  });
});

describe('IncidentForm — step 3 (confirm and submit)', () => {
  function goToStep3() {
    renderForm();
    fireEvent.click(screen.getByRole('button', { name: 'Medisinsk' }));
    fireEvent.click(screen.getByRole('button', { name: 'Neste: MIST →' }));
    fireEvent.click(screen.getByRole('button', { name: 'Forhåndsvis →' }));
  }

  it('calls api.createIncident when "Send hendelse" is clicked', async () => {
    vi.mocked(api.createIncident).mockResolvedValue({ incident: { id: 'inc-new' } });

    goToStep3();

    const sendButton = screen.getByRole('button', { name: /Send hendelse/ });
    fireEvent.click(sendButton);

    await waitFor(() => {
      expect(api.createIncident).toHaveBeenCalledOnce();
    });
  });

  it('uses GPS position by default when GPS is available', async () => {
    vi.mocked(api.createIncident).mockResolvedValue({ incident: { id: 'inc-new' } });
    vi.mocked(useGeolocation).mockReturnValue({
      status: 'ok',
      position: { lat: 60.123456, lng: 11.654321 },
    });

    goToStep3();
    fireEvent.click(screen.getByRole('button', { name: /Send hendelse/ }));

    await waitFor(() => {
      expect(api.createIncident).toHaveBeenCalledWith(
        expect.objectContaining({
          location: expect.objectContaining({
            lat: 60.123456,
            lng: 11.654321,
          }),
        }),
      );
    });
  });

  it('uses manually adjusted coordinates when user overrides position', async () => {
    vi.mocked(api.createIncident).mockResolvedValue({ incident: { id: 'inc-new' } });
    vi.mocked(useGeolocation).mockReturnValue({
      status: 'ok',
      position: { lat: 60.123456, lng: 11.654321 },
    });

    goToStep3();
    fireEvent.change(screen.getByTestId('incident-manual-lat'), { target: { value: '61.111111' } });
    fireEvent.change(screen.getByTestId('incident-manual-lng'), { target: { value: '12.222222' } });
    fireEvent.click(screen.getByTestId('incident-apply-manual-location'));
    fireEvent.click(screen.getByRole('button', { name: /Send hendelse/ }));

    await waitFor(() => {
      expect(api.createIncident).toHaveBeenCalledWith(
        expect.objectContaining({
          location: expect.objectContaining({
            lat: 61.111111,
            lng: 12.222222,
          }),
        }),
      );
    });
  });

  it('keeps indoor locationContext while sending a valid location payload', async () => {
    vi.mocked(api.createIncident).mockResolvedValue({ incident: { id: 'inc-new' } });
    vi.mocked(api.getEventIndoorLayout).mockResolvedValue({
      layout: {
        venueId: 'venue-1',
        venueName: 'Testhall',
        floors: [
          {
            id: 'floor-1',
            label: 'Plan 1',
            zones: [
              { id: 'zone-a', label: 'Sone A', center: { lat: 59.913, lng: 10.752 } },
            ],
          },
        ],
      },
    });
    vi.mocked(useGeolocation).mockReturnValue({
      status: 'ok',
      position: { lat: 59.912345, lng: 10.752211 },
    });

    renderForm();
    await waitFor(() => expect(api.getEventIndoorLayout).toHaveBeenCalled());
    const indoorModeButton = await screen.findByRole('button', { name: /Innendørs lokasjon/i });
    fireEvent.click(indoorModeButton);
    fireEvent.click(screen.getByRole('button', { name: 'Medisinsk' }));
    fireEvent.click(screen.getByRole('button', { name: 'Neste: MIST →' }));
    fireEvent.click(screen.getByRole('button', { name: 'Forhåndsvis →' }));
    fireEvent.click(screen.getByRole('button', { name: /Send hendelse/ }));

    await waitFor(() => {
      expect(api.createIncident).toHaveBeenCalledWith(
        expect.objectContaining({
          location: expect.objectContaining({
            lat: expect.any(Number),
            lng: expect.any(Number),
          }),
          locationContext: expect.objectContaining({
            mode: 'indoor_zone',
            venueId: 'venue-1',
            floorId: 'floor-1',
            zoneId: 'zone-a',
            zoneLabel: 'Sone A',
          }),
        }),
      );
    });
  });
});
