import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  enqueueSickbayAction,
  getRetryableSickbayActions,
  markSickbayActionFailed,
  markSickbayActionSyncing,
  offlineSickbayQueueDb,
  removeSickbayAction,
} from '../lib/offline-sickbay-queue';

describe('offline sick bay action queue', () => {
  beforeEach(async () => {
    await offlineSickbayQueueDb.queue.clear();
  });

  it('enqueues a pending vitals_record action', async () => {
    const clientActionId = await enqueueSickbayAction('pat-1', {
      type: 'vitals_record',
      vitals: { pulse: 112, spo2: 93 },
    });

    const item = await offlineSickbayQueueDb.queue.get(clientActionId);
    expect(item?.patientId).toBe('pat-1');
    expect(item?.status).toBe('pending');
    expect(item?.payload).toEqual({ type: 'vitals_record', vitals: { pulse: 112, spo2: 93 } });
  });

  it('enqueues note_add, status_set and patient_update actions', async () => {
    const noteId = await enqueueSickbayAction('pat-1', { type: 'note_add', text: 'Kald og blek', author: 'Sykepleier' });
    const statusId = await enqueueSickbayAction('pat-1', { type: 'status_set', status: 'in_treatment' });
    const updateId = await enqueueSickbayAction('pat-1', { type: 'patient_update', data: { placementType: 'bed', placementNumber: '3' } });

    expect((await offlineSickbayQueueDb.queue.get(noteId))?.payload).toEqual({ type: 'note_add', text: 'Kald og blek', author: 'Sykepleier' });
    expect((await offlineSickbayQueueDb.queue.get(statusId))?.payload).toEqual({ type: 'status_set', status: 'in_treatment' });
    expect((await offlineSickbayQueueDb.queue.get(updateId))?.payload).toEqual({
      type: 'patient_update',
      data: { placementType: 'bed', placementNumber: '3' },
    });
  });

  it('returns pending+failed items sorted by queuedAt for replay', async () => {
    const first = await enqueueSickbayAction('pat-1', { type: 'status_set', status: 'in_treatment' });
    const second = await enqueueSickbayAction('pat-1', { type: 'note_add', text: 'x', author: 'y' });
    await markSickbayActionFailed(second);

    await offlineSickbayQueueDb.queue.update(first, { queuedAt: '2026-09-23T10:00:02.000Z' });
    await offlineSickbayQueueDb.queue.update(second, { queuedAt: '2026-09-23T10:00:01.000Z' });

    const retryable = await getRetryableSickbayActions();
    expect(retryable.map((item) => item.clientActionId)).toEqual([second, first]);
  });

  it('excludes syncing items from the retryable set', async () => {
    const id = await enqueueSickbayAction('pat-1', { type: 'status_set', status: 'observation' });
    await markSickbayActionSyncing(id);

    const retryable = await getRetryableSickbayActions();
    expect(retryable).toHaveLength(0);
  });

  it('marks syncing, marks failed, and removes an action', async () => {
    const id = await enqueueSickbayAction('pat-1', { type: 'status_set', status: 'observation' });

    await markSickbayActionSyncing(id);
    expect((await offlineSickbayQueueDb.queue.get(id))?.status).toBe('syncing');

    await markSickbayActionFailed(id);
    expect((await offlineSickbayQueueDb.queue.get(id))?.status).toBe('failed');

    await removeSickbayAction(id);
    expect(await offlineSickbayQueueDb.queue.get(id)).toBeUndefined();
  });
});
