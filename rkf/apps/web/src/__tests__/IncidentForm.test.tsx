import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { IncidentForm } from '../pages/IncidentForm';

// Mock the api module
vi.mock('../lib/api', () => ({
  api: {
    createIncident: vi.fn(),
  },
}));

// Mock the auth store so useAuthStore returns a predictable eventId
vi.mock('../stores/auth', () => ({
  useAuthStore: vi.fn(() => ({ eventId: 'evt-1' })),
}));

import { api } from '../lib/api';

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

beforeEach(() => {
  vi.mocked(api.createIncident).mockReset();
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
    expect(screen.getByText(/M — Mechanism/)).toBeInTheDocument();
  });
});

describe('IncidentForm — step 2 (MIST)', () => {
  function goToStep2() {
    renderForm();
    fireEvent.click(screen.getByRole('button', { name: 'Medisinsk' }));
    fireEvent.click(screen.getByRole('button', { name: 'Neste: MIST →' }));
  }

  it('shows all four MIST textarea labels', () => {
    goToStep2();

    expect(screen.getByText(/M — Mechanism/)).toBeInTheDocument();
    expect(screen.getByText(/I — Injury/)).toBeInTheDocument();
    expect(screen.getByText(/S — Signs/)).toBeInTheDocument();
    expect(screen.getByText(/T — Treatment/)).toBeInTheDocument();
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
});
