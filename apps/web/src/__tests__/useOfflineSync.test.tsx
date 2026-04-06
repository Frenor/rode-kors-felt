import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useOfflineSync } from '../hooks/useOfflineSync';

const mocks = vi.hoisted(() => ({
  getRetryableItems: vi.fn(),
  markSyncing: vi.fn(),
  markFailed: vi.fn(),
  removeItem: vi.fn(),
  createIncident: vi.fn(),
  addToast: vi.fn(),
}));

vi.mock('../lib/offline-queue', () => ({
  getRetryableItems: mocks.getRetryableItems,
  markSyncing: mocks.markSyncing,
  markFailed: mocks.markFailed,
  removeItem: mocks.removeItem,
}));

vi.mock('../lib/api', () => ({
  api: {
    createIncident: mocks.createIncident,
  },
}));

vi.mock('../stores/notifications', () => ({
  useNotificationStore: (selector: (state: { add: typeof mocks.addToast }) => unknown) =>
    selector({ add: mocks.addToast }),
}));

describe('useOfflineSync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('flushes retryable incident items on online and shows a toast', async () => {
    mocks.getRetryableItems.mockResolvedValue([
      { clientId: 'inc-1', payload: { type: 'medical' } },
      { clientId: 'inc-2', payload: { type: 'trauma' } },
    ]);
    mocks.createIncident.mockResolvedValue({ incident: { id: 'srv-1' } });

    renderHook(() => useOfflineSync());
    window.dispatchEvent(new Event('online'));

    await waitFor(() => {
      expect(mocks.markSyncing).toHaveBeenCalledTimes(2);
      expect(mocks.createIncident).toHaveBeenCalledTimes(2);
      expect(mocks.removeItem).toHaveBeenCalledTimes(2);
    });

    expect(mocks.markSyncing).toHaveBeenNthCalledWith(1, 'inc-1');
    expect(mocks.markSyncing).toHaveBeenNthCalledWith(2, 'inc-2');
    expect(mocks.removeItem).toHaveBeenNthCalledWith(1, 'inc-1');
    expect(mocks.removeItem).toHaveBeenNthCalledWith(2, 'inc-2');
    expect(mocks.addToast).toHaveBeenCalledWith(
      expect.objectContaining({ message: '2 hendelser synkronisert', level: 'info' }),
    );
  });

  it('marks failed items and still syncs remaining items on ws reconnect', async () => {
    mocks.getRetryableItems.mockResolvedValue([
      { clientId: 'inc-1', payload: { type: 'medical' } },
      { clientId: 'inc-2', payload: { type: 'trauma' } },
    ]);
    mocks.createIncident
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce({ incident: { id: 'srv-2' } });

    renderHook(() => useOfflineSync());
    window.dispatchEvent(new Event('rkf:wsConnected'));

    await waitFor(() => {
      expect(mocks.markFailed).toHaveBeenCalledWith('inc-1');
      expect(mocks.removeItem).toHaveBeenCalledWith('inc-2');
    });

    expect(mocks.removeItem).not.toHaveBeenCalledWith('inc-1');
    expect(mocks.addToast).toHaveBeenCalledWith(
      expect.objectContaining({ message: '1 hendelse synkronisert', level: 'info' }),
    );
  });

  it('does nothing when there are no retryable items', async () => {
    mocks.getRetryableItems.mockResolvedValue([]);

    renderHook(() => useOfflineSync());
    window.dispatchEvent(new Event('online'));

    await waitFor(() => {
      expect(mocks.getRetryableItems).toHaveBeenCalledTimes(1);
    });

    expect(mocks.markSyncing).not.toHaveBeenCalled();
    expect(mocks.createIncident).not.toHaveBeenCalled();
    expect(mocks.markFailed).not.toHaveBeenCalled();
    expect(mocks.removeItem).not.toHaveBeenCalled();
    expect(mocks.addToast).not.toHaveBeenCalled();
  });
});
