import Dexie, { type Table } from 'dexie';

/**
 * Offline write queue for the sick bay (item 8.27) — the field's
 * `offline-firstaid-queue.ts` is the pattern this copies. Every write the
 * sick bay makes (vitals, notes, status changes, card edits) goes here first
 * when `!navigator.onLine`, and `useOfflineSickbaySync` replays it once the
 * connection is back.
 */
export type QueuedSickbayActionPayload =
  | { type: 'vitals_record'; vitals: Record<string, number | string | undefined> }
  | { type: 'note_add'; text: string; author: string }
  | { type: 'status_set'; status: string }
  | { type: 'patient_update'; data: Record<string, unknown> };

export interface QueuedSickbayAction {
  clientActionId: string;
  patientId: string;
  payload: QueuedSickbayActionPayload;
  status: 'pending' | 'syncing' | 'failed';
  queuedAt: string;
}

class OfflineSickbayQueueDb extends Dexie {
  queue!: Table<QueuedSickbayAction>;

  constructor() {
    super('rkf-sickbay-queue');
    this.version(1).stores({ queue: 'clientActionId, patientId, status, queuedAt' });
  }
}

export const offlineSickbayQueueDb = new OfflineSickbayQueueDb();

export async function enqueueSickbayAction(
  patientId: string,
  payload: QueuedSickbayActionPayload,
): Promise<string> {
  const clientActionId = crypto.randomUUID();
  await offlineSickbayQueueDb.queue.put({
    clientActionId,
    patientId,
    payload,
    status: 'pending',
    queuedAt: new Date().toISOString(),
  });
  return clientActionId;
}

export async function getRetryableSickbayActions(): Promise<QueuedSickbayAction[]> {
  const [pending, failed] = await Promise.all([
    offlineSickbayQueueDb.queue.where('status').equals('pending').toArray(),
    offlineSickbayQueueDb.queue.where('status').equals('failed').toArray(),
  ]);
  return [...pending, ...failed].sort((a, b) => a.queuedAt.localeCompare(b.queuedAt));
}

export async function markSickbayActionSyncing(clientActionId: string) {
  await offlineSickbayQueueDb.queue.update(clientActionId, { status: 'syncing' });
}

export async function markSickbayActionFailed(clientActionId: string) {
  await offlineSickbayQueueDb.queue.update(clientActionId, { status: 'failed' });
}

export async function removeSickbayAction(clientActionId: string) {
  await offlineSickbayQueueDb.queue.delete(clientActionId);
}
