/**
 * Offline incident queue — Dexie/IndexedDB backed.
 * Incidents created while offline are queued here and flushed on reconnect.
 */

import Dexie, { type Table } from 'dexie';

export interface QueuedIncident {
  clientId: string;
  payload: Record<string, unknown>;
  status: 'pending' | 'syncing' | 'failed';
  queuedAt: string;
}

class OfflineQueueDb extends Dexie {
  queue!: Table<QueuedIncident>;

  constructor() {
    super('rkf-queue');
    this.version(1).stores({ queue: 'clientId, status, queuedAt' });
  }
}

export const offlineQueueDb = new OfflineQueueDb();

export async function enqueue(payload: Record<string, unknown>): Promise<string> {
  const clientId = (payload.clientId as string) ?? crypto.randomUUID();
  await offlineQueueDb.queue.put({
    clientId,
    payload: { ...payload, clientId },
    status: 'pending',
    queuedAt: new Date().toISOString(),
  });
  return clientId;
}

export async function getPendingItems(): Promise<QueuedIncident[]> {
  return offlineQueueDb.queue.where('status').equals('pending').toArray();
}

export async function markSyncing(clientId: string) {
  await offlineQueueDb.queue.update(clientId, { status: 'syncing' });
}

export async function markFailed(clientId: string) {
  await offlineQueueDb.queue.update(clientId, { status: 'failed' });
}

export async function removeItem(clientId: string) {
  await offlineQueueDb.queue.delete(clientId);
}
