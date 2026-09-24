import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useOfflineSickbaySync } from '../hooks/useOfflineSickbaySync';

const mocks = vi.hoisted(() => ({
  accessToken: null as string | null,
  getRetryableSickbayActions: vi.fn(),
  markSickbayActionSyncing: vi.fn(),
  markSickbayActionFailed: vi.fn(),
  removeSickbayAction: vi.fn(),
  recordVitals: vi.fn(),
  addPatientNote: vi.fn(),
  executePatientAction: vi.fn(),
  updatePatient: vi.fn(),
  addToast: vi.fn(),
}));

vi.mock('../lib/offline-sickbay-queue', () => ({
  getRetryableSickbayActions: mocks.getRetryableSickbayActions,
  markSickbayActionSyncing: mocks.markSickbayActionSyncing,
  markSickbayActionFailed: mocks.markSickbayActionFailed,
  removeSickbayAction: mocks.removeSickbayAction,
}));

vi.mock('../lib/api', () => ({
  api: {
    recordVitals: mocks.recordVitals,
    addPatientNote: mocks.addPatientNote,
    executePatientAction: mocks.executePatientAction,
    updatePatient: mocks.updatePatient,
  },
}));

vi.mock('../stores/notifications', () => ({
  useNotificationStore: (selector: (state: { add: typeof mocks.addToast }) => unknown) =>
    selector({ add: mocks.addToast }),
}));

vi.mock('../stores/auth', () => ({
  useAuthStore: (selector: (state: { accessToken: string | null }) => unknown) =>
    selector({ accessToken: mocks.accessToken }),
}));

describe('useOfflineSickbaySync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.accessToken = null;
  });

  it('flushes leftover queue items on mount when authenticated and online', async () => {
    mocks.accessToken = 'token';
    mocks.getRetryableSickbayActions.mockResolvedValue([
      { clientActionId: 'boot-1', patientId: 'pat-1', payload: { type: 'status_set', status: 'in_treatment' } },
    ]);
    mocks.executePatientAction.mockResolvedValue({ patient: {}, action: {} });

    renderHook(() => useOfflineSickbaySync());

    await waitFor(() => {
      expect(mocks.executePatientAction).toHaveBeenCalledWith('pat-1', { type: 'status.set', status: 'in_treatment' });
      expect(mocks.removeSickbayAction).toHaveBeenCalledWith('boot-1');
    });
  });

  it('does not flush on mount when offline or unauthenticated', async () => {
    mocks.accessToken = null;
    mocks.getRetryableSickbayActions.mockResolvedValue([]);

    renderHook(() => useOfflineSickbaySync());

    // Give any accidental async flush a tick to happen, then assert it didn't.
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(mocks.getRetryableSickbayActions).not.toHaveBeenCalled();
  });

  it('replays each payload type against its own endpoint, in queue order', async () => {
    mocks.getRetryableSickbayActions.mockResolvedValue([
      { clientActionId: 'v-1', patientId: 'pat-1', payload: { type: 'vitals_record', vitals: { pulse: 90 } } },
      { clientActionId: 'n-1', patientId: 'pat-1', payload: { type: 'note_add', text: 'Stabil', author: 'Sykepleier' } },
      { clientActionId: 's-1', patientId: 'pat-1', payload: { type: 'status_set', status: 'observation' } },
      { clientActionId: 'u-1', patientId: 'pat-1', payload: { type: 'patient_update', data: { placementType: 'chair', placementNumber: '4' } } },
    ]);
    mocks.recordVitals.mockResolvedValue({ vitals: {} });
    mocks.addPatientNote.mockResolvedValue({ patient: {} });
    mocks.executePatientAction.mockResolvedValue({ patient: {}, action: {} });
    mocks.updatePatient.mockResolvedValue({ patient: {} });

    renderHook(() => useOfflineSickbaySync());
    window.dispatchEvent(new Event('online'));

    await waitFor(() => {
      expect(mocks.recordVitals).toHaveBeenCalledWith('pat-1', { pulse: 90 });
      expect(mocks.addPatientNote).toHaveBeenCalledWith('pat-1', 'Stabil', 'Sykepleier');
      expect(mocks.executePatientAction).toHaveBeenCalledWith('pat-1', { type: 'status.set', status: 'observation' });
      expect(mocks.updatePatient).toHaveBeenCalledWith('pat-1', { placementType: 'chair', placementNumber: '4' });
    });

    // Replay order matches the queue's returned order (oldest first).
    const vitalsCallOrder = mocks.recordVitals.mock.invocationCallOrder[0]!;
    const noteCallOrder = mocks.addPatientNote.mock.invocationCallOrder[0]!;
    const statusCallOrder = mocks.executePatientAction.mock.invocationCallOrder[0]!;
    const updateCallOrder = mocks.updatePatient.mock.invocationCallOrder[0]!;
    expect(vitalsCallOrder).toBeLessThan(noteCallOrder);
    expect(noteCallOrder).toBeLessThan(statusCallOrder);
    expect(statusCallOrder).toBeLessThan(updateCallOrder);

    expect(mocks.removeSickbayAction).toHaveBeenCalledTimes(4);
    expect(mocks.addToast).toHaveBeenCalledWith(
      expect.objectContaining({ message: '4 handlinger synkronisert', level: 'info' }),
    );
  });

  it('dispatches rkf:sickbayQueueFlushed after a successful flush', async () => {
    mocks.getRetryableSickbayActions.mockResolvedValue([
      { clientActionId: 'v-1', patientId: 'pat-1', payload: { type: 'vitals_record', vitals: { pulse: 90 } } },
    ]);
    mocks.recordVitals.mockResolvedValue({ vitals: {} });

    const handler = vi.fn();
    window.addEventListener('rkf:sickbayQueueFlushed', handler);

    renderHook(() => useOfflineSickbaySync());
    window.dispatchEvent(new Event('online'));

    await waitFor(() => {
      expect(handler).toHaveBeenCalledTimes(1);
    });
    window.removeEventListener('rkf:sickbayQueueFlushed', handler);
  });

  it('does not dispatch rkf:sickbayQueueFlushed when nothing was queued', async () => {
    mocks.getRetryableSickbayActions.mockResolvedValue([]);

    const handler = vi.fn();
    window.addEventListener('rkf:sickbayQueueFlushed', handler);

    renderHook(() => useOfflineSickbaySync());
    window.dispatchEvent(new Event('online'));

    await waitFor(() => {
      expect(mocks.getRetryableSickbayActions).toHaveBeenCalled();
    });
    expect(handler).not.toHaveBeenCalled();
    window.removeEventListener('rkf:sickbayQueueFlushed', handler);
  });

  it('marks a failed replay and keeps it queued, without dispatching a flush event', async () => {
    mocks.getRetryableSickbayActions.mockResolvedValue([
      { clientActionId: 'v-1', patientId: 'pat-1', payload: { type: 'vitals_record', vitals: { pulse: 90 } } },
    ]);
    mocks.recordVitals.mockRejectedValue(new Error('network'));

    const handler = vi.fn();
    window.addEventListener('rkf:sickbayQueueFlushed', handler);

    renderHook(() => useOfflineSickbaySync());
    window.dispatchEvent(new Event('online'));

    await waitFor(() => {
      expect(mocks.markSickbayActionFailed).toHaveBeenCalledWith('v-1');
    });
    expect(mocks.removeSickbayAction).not.toHaveBeenCalled();
    expect(handler).not.toHaveBeenCalled();
    window.removeEventListener('rkf:sickbayQueueFlushed', handler);
  });

  it('does not replay the same items twice when triggers overlap', async () => {
    let resolveFirst: (() => void) | null = null;
    mocks.getRetryableSickbayActions
      .mockImplementationOnce(() => new Promise((resolve) => {
        resolveFirst = () => resolve([
          { clientActionId: 'act-1', patientId: 'pat-1', payload: { type: 'status_set', status: 'observation' } },
        ]);
      }))
      .mockResolvedValue([]);
    mocks.executePatientAction.mockResolvedValue({ patient: {}, action: {} });

    renderHook(() => useOfflineSickbaySync());
    window.dispatchEvent(new Event('online'));
    window.dispatchEvent(new Event('rkf:wsConnected'));
    resolveFirst!();

    await waitFor(() => {
      expect(mocks.executePatientAction).toHaveBeenCalledTimes(1);
      expect(mocks.getRetryableSickbayActions).toHaveBeenCalledTimes(2);
    });
  });
});
