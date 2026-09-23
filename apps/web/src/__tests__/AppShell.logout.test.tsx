/**
 * AppShell — logout clearing (gap B8 / item 8.33). Logging out must not leave
 * another role's offline queue or pending-assignment banners on the device
 * for whoever logs in next.
 */
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { AppShell } from '../components/AppShell';

const mockLogout = vi.fn();
vi.mock('../stores/auth', () => ({
  useAuthStore: vi.fn(() => ({
    role: 'coordinator',
    eventName: 'Test Event',
    logout: mockLogout,
    accessToken: null,
    eventId: null,
  })),
}));

vi.mock('../stores/ws', () => ({
  useWsStore: vi.fn(() => ({ connect: vi.fn(), disconnect: vi.fn(), status: 'disconnected' })),
}));

vi.mock('../hooks/useOfflineTeamSync', () => ({
  useOfflineTeamSync: vi.fn(),
}));

describe('AppShell — logout clearing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('deletes both offline queue IndexedDB databases and clears pending-assignment keys, then logs out', () => {
    localStorage.setItem('rkf-pending-assignments:evt-1:team-alpha', JSON.stringify(['pat-1']));
    localStorage.setItem('rkf-pending-assignments:evt-2:team-bravo', JSON.stringify(['pat-2']));
    localStorage.setItem('rkf-demo', '1'); // an unrelated key must survive

    const deleteSpy = vi.spyOn(indexedDB, 'deleteDatabase');

    render(
      <MemoryRouter>
        <AppShell><div>content</div></AppShell>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Logg ut' }));

    expect(deleteSpy).toHaveBeenCalledWith('rkf-firstaid-queue');
    expect(deleteSpy).toHaveBeenCalledWith('rkf-sickbay-queue');
    expect(localStorage.getItem('rkf-pending-assignments:evt-1:team-alpha')).toBeNull();
    expect(localStorage.getItem('rkf-pending-assignments:evt-2:team-bravo')).toBeNull();
    expect(localStorage.getItem('rkf-demo')).toBe('1');
    expect(mockLogout).toHaveBeenCalledTimes(1);
  });

  it('still logs out even if clearing the offline state throws', () => {
    const deleteSpy = vi.spyOn(indexedDB, 'deleteDatabase').mockImplementation(() => {
      throw new Error('boom');
    });
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    render(
      <MemoryRouter>
        <AppShell><div>content</div></AppShell>
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Logg ut' }));

    expect(mockLogout).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalled();
    deleteSpy.mockRestore();
    warnSpy.mockRestore();
  });
});
