import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  enqueueTeamAction,
  getPendingTeamActions,
  getRetryableTeamActions,
  markTeamActionFailed,
  markTeamActionSyncing,
  offlineFirstAiderQueueDb,
  removeTeamAction,
} from '../lib/offline-firstaid-queue';

describe('offline first-aider team action queue', () => {
  beforeEach(async () => {
    await offlineFirstAiderQueueDb.queue.clear();
  });

  it('enqueues a pending team action', async () => {
    const clientActionId = await enqueueTeamAction('team-1', {
      type: 'team.status_set',
      status: 'on_scene',
      clientActionId: 'act-1',
    });

    const item = await offlineFirstAiderQueueDb.queue.get('act-1');
    expect(clientActionId).toBe('act-1');
    expect(item?.teamId).toBe('team-1');
    expect(item?.status).toBe('pending');
  });

  it('returns pending-only items from getPendingTeamActions', async () => {
    await enqueueTeamAction('team-1', { type: 'team.monitor_started', patientId: 'pat-1', clientActionId: 'act-1' });
    await enqueueTeamAction('team-1', { type: 'team.monitor_stopped', patientId: 'pat-1', clientActionId: 'act-2' });
    await markTeamActionFailed('act-2');

    const pending = await getPendingTeamActions();
    expect(pending.map((item) => item.clientActionId)).toEqual(['act-1']);
  });

  it('returns pending+failed items sorted by queuedAt for replay', async () => {
    await enqueueTeamAction('team-1', { type: 'team.monitor_started', patientId: 'pat-1', clientActionId: 'act-1' });
    await enqueueTeamAction('team-1', { type: 'team.monitor_stopped', patientId: 'pat-1', clientActionId: 'act-2' });
    await markTeamActionFailed('act-2');

    await offlineFirstAiderQueueDb.queue.update('act-1', { queuedAt: '2026-04-06T10:00:02.000Z' });
    await offlineFirstAiderQueueDb.queue.update('act-2', { queuedAt: '2026-04-06T10:00:01.000Z' });

    const retryable = await getRetryableTeamActions();
    expect(retryable.map((item) => item.clientActionId)).toEqual(['act-2', 'act-1']);
  });

  it('marks syncing, marks failed, and removes team actions', async () => {
    await enqueueTeamAction('team-1', { type: 'team.monitor_started', patientId: 'pat-1', clientActionId: 'act-1' });

    await markTeamActionSyncing('act-1');
    expect((await offlineFirstAiderQueueDb.queue.get('act-1'))?.status).toBe('syncing');

    await markTeamActionFailed('act-1');
    expect((await offlineFirstAiderQueueDb.queue.get('act-1'))?.status).toBe('failed');

    await removeTeamAction('act-1');
    expect(await offlineFirstAiderQueueDb.queue.get('act-1')).toBeUndefined();
  });
});
