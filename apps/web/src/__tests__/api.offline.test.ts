import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  enqueue: vi.fn(),
  enqueueTeamAction: vi.fn(),
}));

vi.mock('../lib/offline-queue', () => ({
  enqueue: mocks.enqueue,
}));

vi.mock('../lib/offline-firstaid-queue', () => ({
  enqueueTeamAction: mocks.enqueueTeamAction,
}));

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
});

describe('ApiClient offline queue integration', () => {
  it('queues incident creation when offline', async () => {
    mocks.enqueue.mockResolvedValue('inc-offline-1');
    vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(false);
    const fetchMock = vi.spyOn(globalThis, 'fetch');

    vi.resetModules();
    const { api } = await import('../lib/api');
    const result = await api.createIncident({ type: 'medical', eventId: 'evt-1' });

    expect(mocks.enqueue).toHaveBeenCalledWith({ type: 'medical', eventId: 'evt-1' });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result).toEqual({
      incident: { id: 'inc-offline-1', _queued: true, type: 'medical', eventId: 'evt-1' },
    });
  });

  it('queues team action when offline unless skipOfflineQueue is set', async () => {
    vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(false);

    vi.resetModules();
    const { api } = await import('../lib/api');
    const payload = { type: 'team.monitor_started' as const, patientId: 'pat-1', clientActionId: 'act-1' };
    const result = await api.postTeamAction('team-1', payload);

    expect(mocks.enqueueTeamAction).toHaveBeenCalledWith('team-1', payload);
    expect(result).toEqual({
      action: expect.objectContaining({
        id: 'act-1',
        actionType: 'team.monitor_started',
        _queued: true,
      }),
    });
  });

  it('bypasses offline queue when skipOfflineQueue is true', async () => {
    vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(false);
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({ action: { id: 'srv-action' } }),
    } as unknown as Response);

    vi.resetModules();
    const { api } = await import('../lib/api');
    const payload = { type: 'team.monitor_started' as const, patientId: 'pat-1', clientActionId: 'act-1' };
    const result = await api.postTeamAction('team-1', payload, { skipOfflineQueue: true });

    expect(mocks.enqueueTeamAction).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(result).toEqual({ action: { id: 'srv-action' } });
  });
});
