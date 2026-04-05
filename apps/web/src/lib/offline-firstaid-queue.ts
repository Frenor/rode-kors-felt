import Dexie, { type Table } from 'dexie';
import type { TeamOperationalStatus } from './types';

export type QueuedTeamActionPayload =
  | {
      type: 'team.status_set';
      status: TeamOperationalStatus;
      incidentId?: string;
      note?: string;
      clientActionId: string;
    }
  | {
      type: 'team.monitor_started';
      patientId: string;
      clientActionId: string;
    }
  | {
      type: 'team.monitor_stopped';
      patientId: string;
      clientActionId: string;
    };

export interface QueuedTeamAction {
  clientActionId: string;
  teamId: string;
  payload: QueuedTeamActionPayload;
  status: 'pending' | 'syncing' | 'failed';
  queuedAt: string;
}

class OfflineFirstAiderQueueDb extends Dexie {
  queue!: Table<QueuedTeamAction>;

  constructor() {
    super('rkf-firstaid-queue');
    this.version(1).stores({ queue: 'clientActionId, teamId, status, queuedAt' });
  }
}

export const offlineFirstAiderQueueDb = new OfflineFirstAiderQueueDb();

export async function enqueueTeamAction(teamId: string, payload: QueuedTeamActionPayload): Promise<string> {
  await offlineFirstAiderQueueDb.queue.put({
    clientActionId: payload.clientActionId,
    teamId,
    payload,
    status: 'pending',
    queuedAt: new Date().toISOString(),
  });
  return payload.clientActionId;
}

export async function getPendingTeamActions(): Promise<QueuedTeamAction[]> {
  return offlineFirstAiderQueueDb.queue.where('status').equals('pending').toArray();
}

export async function getRetryableTeamActions(): Promise<QueuedTeamAction[]> {
  const [pending, failed] = await Promise.all([
    offlineFirstAiderQueueDb.queue.where('status').equals('pending').toArray(),
    offlineFirstAiderQueueDb.queue.where('status').equals('failed').toArray(),
  ]);
  return [...pending, ...failed].sort((a, b) => a.queuedAt.localeCompare(b.queuedAt));
}

export async function markTeamActionSyncing(clientActionId: string) {
  await offlineFirstAiderQueueDb.queue.update(clientActionId, { status: 'syncing' });
}

export async function markTeamActionFailed(clientActionId: string) {
  await offlineFirstAiderQueueDb.queue.update(clientActionId, { status: 'failed' });
}

export async function removeTeamAction(clientActionId: string) {
  await offlineFirstAiderQueueDb.queue.delete(clientActionId);
}
