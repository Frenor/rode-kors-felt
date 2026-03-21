import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CodeEntryPage } from '../pages/CodeEntryPage';
import { useAuthStore } from '../stores/auth';

// Mock the api module
vi.mock('../lib/api', () => ({
  api: {
    redeemCode: vi.fn(),
  },
}));

// Mock useNavigate so we can assert navigation
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

import { api } from '../lib/api';

const initialState = {
  accessToken: null,
  refreshToken: null,
  role: null,
  eventId: null,
  eventName: null,
  teams: [],
  isAuthenticated: false,
};

function renderPage() {
  return render(
    <MemoryRouter>
      <CodeEntryPage />
    </MemoryRouter>
  );
}

beforeEach(() => {
  useAuthStore.setState(initialState);
  mockNavigate.mockReset();
  vi.mocked(api.redeemCode).mockReset();
});

describe('CodeEntryPage — numpad', () => {
  it('renders a button for each digit 0–9', () => {
    renderPage();
    for (const digit of ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']) {
      expect(screen.getByRole('button', { name: digit })).toBeInTheDocument();
    }
  });

  it('renders a backspace button', () => {
    renderPage();
    expect(screen.getByRole('button', { name: 'Slett siste siffer' })).toBeInTheDocument();
  });

  it('adds digits to the code display when digit buttons are clicked', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: '4' }));
    fireEvent.click(screen.getByRole('button', { name: '2' }));

    // The code display has aria-label reflecting the current code
    const display = screen.getByRole('status');
    expect(display).toHaveAttribute('aria-label', 'Kode: 42');
  });

  it('removes the last digit when backspace is clicked', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: '7' }));
    fireEvent.click(screen.getByRole('button', { name: '3' }));
    fireEvent.click(screen.getByRole('button', { name: 'Slett siste siffer' }));

    const display = screen.getByRole('status');
    expect(display).toHaveAttribute('aria-label', 'Kode: 7');
  });
});

describe('CodeEntryPage — submit button', () => {
  it('is disabled when fewer than 6 digits are entered', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: '1' }));
    fireEvent.click(screen.getByRole('button', { name: '2' }));

    expect(screen.getByRole('button', { name: 'Koble til arrangement' })).toBeDisabled();
  });

  it('is enabled when exactly 6 digits are entered', () => {
    renderPage();
    for (const digit of ['1', '2', '3', '4', '5', '6']) {
      fireEvent.click(screen.getByRole('button', { name: digit }));
    }

    expect(screen.getByRole('button', { name: 'Koble til arrangement' })).not.toBeDisabled();
  });
});

describe('CodeEntryPage — submission', () => {
  function enterSixDigits() {
    for (const digit of ['1', '2', '3', '4', '5', '6']) {
      fireEvent.click(screen.getByRole('button', { name: digit }));
    }
  }

  it('navigates to /firstaid on successful code redemption with role first_aider', async () => {
    vi.mocked(api.redeemCode).mockResolvedValue({
      accessToken: 'tok',
      refreshToken: 'ref',
      role: 'first_aider',
      eventId: 'e1',
      eventName: 'Test',
      teams: [],
    });

    renderPage();
    enterSixDigits();
    fireEvent.click(screen.getByRole('button', { name: 'Koble til arrangement' }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/firstaid');
    });
  });

  it('shows an error message when code redemption fails', async () => {
    vi.mocked(api.redeemCode).mockRejectedValue(new Error('Ugyldig kode'));

    renderPage();
    enterSixDigits();
    fireEvent.click(screen.getByRole('button', { name: 'Koble til arrangement' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Ugyldig kode');
    });
  });
});
