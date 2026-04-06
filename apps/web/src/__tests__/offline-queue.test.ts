import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  enqueue,
  getPendingItems,
  getRetryableItems,
  markFailed,
  markSyncing,
  offlineQueueDb,
  removeItem,
} from '../lib/offline-queue';

describe('offline incident queue', () => {
  beforeEach(async () => {
    await offlineQueueDb.queue.clear();
  });

  it('enqueues payloads as pending and injects a clientId when missing', async () => {
    const clientId = await enqueue({ type: 'medical', eventId: 'evt-1' });
    const item = await offlineQueueDb.queue.get(clientId);

    expect(item).toBeTruthy();
    expect(item?.status).toBe('pending');
    expect(item?.payload.clientId).toBe(clientId);
  });

  it('keeps a provided clientId', async () => {
    const clientId = await enqueue({ clientId: 'inc-client-1', type: 'medical' });
    const item = await offlineQueueDb.queue.get('inc-client-1');

    expect(clientId).toBe('inc-client-1');
    expect(item?.payload.clientId).toBe('inc-client-1');
  });

  it('returns pending-only items from getPendingItems', async () => {
    await enqueue({ clientId: 'inc-1', type: 'medical' });
    await enqueue({ clientId: 'inc-2', type: 'medical' });
    await markFailed('inc-2');

    const pending = await getPendingItems();
    expect(pending.map((item) => item.clientId)).toEqual(['inc-1']);
  });

  it('returns pending+failed items in queuedAt order for retry replay', async () => {
    await enqueue({ clientId: 'inc-1', type: 'medical' });
    await enqueue({ clientId: 'inc-2', type: 'medical' });
    await markFailed('inc-2');

    await offlineQueueDb.queue.update('inc-1', { queuedAt: '2026-04-06T10:00:02.000Z' });
    await offlineQueueDb.queue.update('inc-2', { queuedAt: '2026-04-06T10:00:01.000Z' });

    const retryable = await getRetryableItems();
    expect(retryable.map((item) => item.clientId)).toEqual(['inc-2', 'inc-1']);
  });

  it('marks syncing, marks failed, and removes items', async () => {
    await enqueue({ clientId: 'inc-1', type: 'medical' });

    await markSyncing('inc-1');
    expect((await offlineQueueDb.queue.get('inc-1'))?.status).toBe('syncing');

    await markFailed('inc-1');
    expect((await offlineQueueDb.queue.get('inc-1'))?.status).toBe('failed');

    await removeItem('inc-1');
    expect(await offlineQueueDb.queue.get('inc-1')).toBeUndefined();
  });

  it('returns live pending queue count', async () => {
    await enqueue({ clientId: 'inc-1', type: 'medical' });
    await enqueue({ clientId: 'inc-2', type: 'medical' });
    await markFailed('inc-2');

    const count = (await getPendingItems()).length;
    expect(count).toBe(1);
  });
});
