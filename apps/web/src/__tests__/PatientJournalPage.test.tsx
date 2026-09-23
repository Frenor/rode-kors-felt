/**
 * PatientJournalPage (gap B7 / item 8.32) — printable journal render with a
 * mocked api, including the fail-loud error state.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { PatientJournalPage } from '../pages/PatientJournalPage';
import { useAuthStore } from '../stores/auth';
import type { PatientJournal } from '../lib/types';

vi.mock('../lib/api', () => ({
  api: {
    getPatientJournal: vi.fn(),
  },
}));

import { api } from '../lib/api';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

function renderAt(patientId: string) {
  return render(
    <MemoryRouter initialEntries={[`/sickbay/journal/${patientId}`]}>
      <Routes>
        <Route path="/sickbay/journal/:patientId" element={<PatientJournalPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

function makeJournal(overrides: Partial<PatientJournal> = {}): PatientJournal {
  return {
    patient: {
      id: 'pat-1',
      eventId: 'evt-1',
      seq: 12,
      ageGroup: 'adult',
      fullName: 'Kari Nordmann',
      gender: 'female',
      ageYears: 40,
      status: 'in_treatment',
      presentingComplaint: 'Brystsmerter',
      assignedClinician: 'Lege Andersen',
      triageStatus: 'yellow',
      placementType: 'bed',
      placementNumber: '2',
      vitalsHistory: [],
      latestVitals: null,
      notes: [],
      createdAt: '2026-09-23T10:00:00Z',
      updatedAt: '2026-09-23T10:00:00Z',
    },
    vitalsHistory: [
      { pulse: 88, spo2: 96, respiratoryRate: 18, systolicBP: 120, temperature: 37.0, acvpu: 'alert', timestamp: '2026-09-23T10:10:00Z' },
    ],
    notes: [{ id: 'n1', text: 'Stabil', author: 'Sykepleier Bakke', createdAt: '2026-09-23T10:05:00Z' }],
    medications: [{ id: 'm1', drug: 'oxygen', dose: '4 L/min', route: 'inhaled', givenBy: 'Lege Andersen', givenAt: '2026-09-23T10:02:00Z' }],
    amkCallLogs: [{ id: 'a1', calledAt: '2026-09-23T10:15:00Z', summaryGiven: 'Brystsmerter', amkGuidance: 'Send ambulanse', followUpOwner: 'Lege Andersen' }],
    actionHistory: [],
    teams: [{ id: 'team-alpha', name: 'Alpha' }],
    ...overrides,
  };
}

beforeEach(() => {
  vi.mocked(api.getPatientJournal).mockReset();
  mockNavigate.mockReset();
  useAuthStore.setState({ eventName: 'Holmenkollen Skimaraton 2026' } as any);
});

describe('PatientJournalPage', () => {
  it('renders the patient number, name and a vitals row with NEWS2', async () => {
    vi.mocked(api.getPatientJournal).mockResolvedValue(makeJournal());
    renderAt('pat-1');

    await waitFor(() => {
      expect(api.getPatientJournal).toHaveBeenCalledWith('pat-1');
    });

    const heading = await screen.findByRole('heading', { name: /#12/ });
    expect(heading).toHaveTextContent('Kari Nordmann');
    expect(screen.getAllByTestId('journal-vitals-row')).toHaveLength(1);
    expect(screen.getByText(/Stabil/)).toBeInTheDocument();
    expect(screen.getByText(/oxygen/)).toBeInTheDocument();
    expect(screen.getByText(/Send ambulanse/)).toBeInTheDocument();
  });

  it('shows an empty-state line instead of a table when there are no vitals', async () => {
    vi.mocked(api.getPatientJournal).mockResolvedValue(makeJournal({ vitalsHistory: [] }));
    renderAt('pat-1');
    await screen.findByRole('heading', { name: /#12/ });
    expect(screen.getByText('Ingen vitale tegn registrert.')).toBeInTheDocument();
  });

  it('fails loud with a visible error instead of a blank or fake journal', async () => {
    vi.mocked(api.getPatientJournal).mockRejectedValue(new Error('Nettverksfeil'));
    renderAt('pat-1');

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Nettverksfeil');
    expect(screen.queryByTestId('journal-vitals-row')).not.toBeInTheDocument();
  });

  it('prints via window.print and navigates back on "Tilbake"', async () => {
    vi.mocked(api.getPatientJournal).mockResolvedValue(makeJournal());
    renderAt('pat-1');
    await screen.findByRole('heading', { name: /#12/ });

    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});
    screen.getByRole('button', { name: 'Skriv ut' }).click();
    expect(printSpy).toHaveBeenCalled();

    screen.getByRole('button', { name: 'Tilbake' }).click();
    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });
});
