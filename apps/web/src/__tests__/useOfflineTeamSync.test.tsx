import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useOfflineTeamSync } from '../hooks/useOfflineTeamSync';

const mocks = vi.hoisted(() => ({
  eventId: 'evt-1' as string | null,
  getRetryableTeamActions: vi.fn(),
  markTeamActionSyncing: vi.fn(),
  markTeamActionFailed: vi.fn(),
  removeTeamAction: vi.fn(),
  postTeamAction: vi.fn(),
  addToast: vi.fn(),
  setTeamSyncedAt: vi.fn(),
}));

vi.mock('../lib/offline-firstaid-queue', () => ({
  getRetryableTeamActions: mocks.getRetryableTeamActions,
  markTeamActionSyncing: mocks.markTeamActionSyncing,
  markTeamActionFailed: mocks.markTeamActionFailed,
  removeTeamAction: mocks.removeTeamAction,
}));

vi.mock('../lib/api', () => ({
  api: {
    postTeamAction: mocks.postTeamAction,
  },
}));

vi.mock('../stores/notifications', () => ({
  useNotificationStore: (selector: (state: { add: typeof mocks.addToast }) => unknown) =>
    selector({ add: mocks.addToast }),
}));

vi.mock('../stores/firstaid-workspace', () => ({
  useFirstAidWorkspaceStore: (selector: (state: { setTeamSyncedAt: typeof mocks.setTeamSyncedAt }) => unknown) =>
    selector({ setTeamSyncedAt: mocks.setTeamSyncedAt }),
}));

vi.mock('../stores/auth', () => ({
  useAuthStore: (selector: (state: { eventId: string | null }) => unknown) =>
    selector({ eventId: mocks.eventId }),
}));

describe('useOfflineTeamSync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.eventId = 'evt-1';
  });

  it('flushes retryable team actions and updates synced timestamp', async () => {
    mocks.getRetryableTeamActions.mockResolvedValue([
      {
        clientActionId: 'act-1',
        teamId: 'team-1',
        payload: { type: 'team.monitor_started', patientId: 'pat-1', clientActionId: 'act-1' },
      },
      {
        clientActionId: 'act-2',
        teamId: 'team-1',
        payload: { type: 'team.monitor_stopped', patientId: 'pat-1', clientActionId: 'act-2' },
      },
    ]);
    mocks.postTeamAction.mockResolvedValue({ action: { id: 'server-action' } });

    renderHook(() => useOfflineTeamSync());
    window.dispatchEvent(new Event('online'));

    await waitFor(() => {
      expect(mocks.markTeamActionSyncing).toHaveBeenCalledTimes(2);
      expect(mocks.postTeamAction).toHaveBeenCalledTimes(2);
      expect(mocks.removeTeamAction).toHaveBeenCalledTimes(2);
      expect(mocks.setTeamSyncedAt).toHaveBeenCalledTimes(2);
    });

    expect(mocks.postTeamAction).toHaveBeenNthCalledWith(
      1,
      'team-1',
      { type: 'team.monitor_started', patientId: 'pat-1', clientActionId: 'act-1' },
      { skipOfflineQueue: true },
    );
    expect(mocks.postTeamAction).toHaveBeenNthCalledWith(
      2,
      'team-1',
      { type: 'team.monitor_stopped', patientId: 'pat-1', clientActionId: 'act-2' },
      { skipOfflineQueue: true },
    );
    expect(mocks.addToast).toHaveBeenCalledWith(
      expect.objectContaining({ message: '2 laghandlinger synkronisert', level: 'info' }),
    );
  });

  it('marks failed actions and skips teamSyncedAt when no eventId is available', async () => {
    mocks.eventId = null;
    mocks.getRetryableTeamActions.mockResolvedValue([
      {
        clientActionId: 'act-1',
        teamId: 'team-1',
        payload: { type: 'team.monitor_started', patientId: 'pat-1', clientActionId: 'act-1' },
      },
    ]);
    mocks.postTeamAction.mockRejectedValue(new Error('network'));

    renderHook(() => useOfflineTeamSync());
    window.dispatchEvent(new Event('rkf:wsConnected'));

    await waitFor(() => {
      expect(mocks.markTeamActionFailed).toHaveBeenCalledWith('act-1');
    });

    expect(mocks.removeTeamAction).not.toHaveBeenCalled();
    expect(mocks.setTeamSyncedAt).not.toHaveBeenCalled();
    expect(mocks.addToast).not.toHaveBeenCalled();
  });

  it('does nothing when there are no retryable team actions', async () => {
    mocks.getRetryableTeamActions.mockResolvedValue([]);

    renderHook(() => useOfflineTeamSync());
    window.dispatchEvent(new Event('online'));

    await waitFor(() => {
      expect(mocks.getRetryableTeamActions).toHaveBeenCalledTimes(1);
    });

    expect(mocks.markTeamActionSyncing).not.toHaveBeenCalled();
    expect(mocks.postTeamAction).not.toHaveBeenCalled();
    expect(mocks.markTeamActionFailed).not.toHaveBeenCalled();
    expect(mocks.removeTeamAction).not.toHaveBeenCalled();
    expect(mocks.setTeamSyncedAt).not.toHaveBeenCalled();
    expect(mocks.addToast).not.toHaveBeenCalled();
  });

  it('uses singular toast grammar when exactly one action is synced', async () => {
    mocks.getRetryableTeamActions.mockResolvedValue([
      {
        clientActionId: 'act-1',
        teamId: 'team-1',
        payload: { type: 'team.monitor_started', patientId: 'pat-1', clientActionId: 'act-1' },
      },
    ]);
    mocks.postTeamAction.mockResolvedValue({ action: { id: 'server-action' } });

    renderHook(() => useOfflineTeamSync());
    window.dispatchEvent(new Event('online'));

    await waitFor(() => {
      expect(mocks.addToast).toHaveBeenCalledWith(
        expect.objectContaining({ message: '1 laghandling synkronisert', level: 'info' }),
      );
    });
  });
});
