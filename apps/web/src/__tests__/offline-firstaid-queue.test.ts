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

  it('enqueues a team.patient_status_set action with a non-null status', async () => {
    const clientActionId = await enqueueTeamAction('team-1', {
      type: 'team.patient_status_set',
      patientId: 'pat-1',
      status: 'en_route_to_patient',
      clientActionId: 'ps-act-1',
    });
    expect(clientActionId).toBe('ps-act-1');
    const stored = await offlineFirstAiderQueueDb.queue.get('ps-act-1');
    expect(stored).toBeDefined();
    expect(stored!.payload.type).toBe('team.patient_status_set');
    expect((stored!.payload as any).status).toBe('en_route_to_patient');
    expect((stored!.payload as any).patientId).toBe('pat-1');
  });

  it('enqueues a team.patient_status_set action with null status (clearing engagement)', async () => {
    const clientActionId = await enqueueTeamAction('team-1', {
      type: 'team.patient_status_set',
      patientId: 'pat-2',
      status: null,
      clientActionId: 'ps-act-2',
    });
    expect(clientActionId).toBe('ps-act-2');
    const stored = await offlineFirstAiderQueueDb.queue.get('ps-act-2');
    expect(stored).toBeDefined();
    expect((stored!.payload as any).status).toBeNull();
  });
});
