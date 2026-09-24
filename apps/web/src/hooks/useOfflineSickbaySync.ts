import { useEffect } from 'react';
import { api } from '../lib/api';
import {
  getRetryableSickbayActions,
  markSickbayActionFailed,
  markSickbayActionSyncing,
  removeSickbayAction,
  type QueuedSickbayAction,
} from '../lib/offline-sickbay-queue';
import { useNotificationStore } from '../stores/notifications';
import { useAuthStore } from '../stores/auth';

/**
 * Replays queued sick bay writes (vitals, notes, status changes, card edits)
 * that were written locally while offline or that failed earlier — the
 * field's `useOfflineTeamSync` is the pattern this copies.
 *
 * Triggers:
 *  - on mount, when authenticated and online (picks up whatever a previous
 *    session left queued)
 *  - `online` event
 *  - `rkf:wsConnected` (successful websocket (re)connect)
 *
 * Only one flush runs at a time; a trigger that arrives mid-flush schedules
 * exactly one follow-up flush instead of replaying the same items twice.
 * After a successful flush, dispatches `rkf:sickbayQueueFlushed` so the
 * dashboard can refetch and drop its optimistic "lagret lokalt" markers.
 */
async function replayQueuedSickbayAction(item: QueuedSickbayAction): Promise<void> {
  const { payload, patientId } = item;
  if (payload.type === 'vitals_record') {
    await api.recordVitals(patientId, payload.vitals as Record<string, number | undefined>);
  } else if (payload.type === 'note_add') {
    await api.addPatientNote(patientId, payload.text, payload.author);
  } else if (payload.type === 'status_set') {
    await api.executePatientAction(patientId, { type: 'status.set', status: payload.status });
  } else {
    await api.updatePatient(patientId, payload.data);
  }
}

export function useOfflineSickbaySync() {
  const addToast = useNotificationStore((s) => s.add);
  const accessToken = useAuthStore((s) => s.accessToken);

  useEffect(() => {
    let flushing = false;
    let rerunRequested = false;
    let cancelled = false;

    async function flushOnce() {
      const items = await getRetryableSickbayActions();
      if (items.length === 0) return;

      let synced = 0;
      for (const item of items) {
        if (cancelled) return;
        try {
          await markSickbayActionSyncing(item.clientActionId);
          await replayQueuedSickbayAction(item);
          await removeSickbayAction(item.clientActionId);
          synced++;
        } catch {
          await markSickbayActionFailed(item.clientActionId);
        }
      }

      if (synced > 0) {
        addToast({
          level: 'info',
          message: `${synced} handling${synced === 1 ? '' : 'er'} synkronisert`,
          autoDismissMs: 4_000,
        });
        window.dispatchEvent(new Event('rkf:sickbayQueueFlushed'));
      }
    }

    async function flush() {
      if (flushing) {
        rerunRequested = true;
        return;
      }
      flushing = true;
      try {
        do {
          rerunRequested = false;
          await flushOnce();
        } while (rerunRequested && !cancelled);
      } finally {
        flushing = false;
      }
    }

    const handleTrigger = () => {
      void flush();
    };

    window.addEventListener('online', handleTrigger);
    window.addEventListener('rkf:wsConnected', handleTrigger);

    // Startup flush: pick up anything left over from a previous session.
    if (accessToken && navigator.onLine) {
      void flush();
    }

    return () => {
      cancelled = true;
      window.removeEventListener('online', handleTrigger);
      window.removeEventListener('rkf:wsConnected', handleTrigger);
    };
  }, [accessToken, addToast]);
}
