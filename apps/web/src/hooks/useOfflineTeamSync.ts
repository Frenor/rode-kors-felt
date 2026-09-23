import { useEffect } from 'react';
import { api } from '../lib/api';
import {
  getRetryableTeamActions,
  markTeamActionFailed,
  markTeamActionSyncing,
  removeTeamAction,
  type QueuedTeamAction,
} from '../lib/offline-firstaid-queue';
import { useNotificationStore } from '../stores/notifications';
import { useFirstAidWorkspaceStore } from '../stores/firstaid-workspace';
import { useAuthStore } from '../stores/auth';

/**
 * Replays queued team actions (status changes, patient engagement) that were
 * written locally while offline or that failed earlier.
 *
 * Triggers:
 *  - on mount, when the browser reports it is online (the app may have been
 *    killed with items still queued — the old code only flushed on the next
 *    online/reconnect event, so a queue could sit unsynced for the whole shift)
 *  - `online` event
 *  - `rkf:wsConnected` (successful websocket (re)connect)
 *
 * Only one flush runs at a time; a trigger that arrives mid-flush schedules
 * exactly one follow-up flush instead of replaying the same items twice.
 */
/** Replays one queued item against the endpoint it belongs to. */
async function replayQueuedAction(item: QueuedTeamAction): Promise<void> {
  const { payload } = item;
  if (payload.type === 'patient.vitals_record') {
    await api.recordVitals(payload.patientId, payload.vitals as Record<string, number | undefined>);
  } else if (payload.type === 'patient.note_add') {
    await api.addPatientNote(payload.patientId, payload.text, payload.author);
  } else {
    await api.postTeamAction(item.teamId, payload, { skipOfflineQueue: true });
  }
}

export function useOfflineTeamSync() {
  const addToast = useNotificationStore((s) => s.add);
  const setTeamSyncedAt = useFirstAidWorkspaceStore((s) => s.setTeamSyncedAt);
  const eventId = useAuthStore((s) => s.eventId);
  const accessToken = useAuthStore((s) => s.accessToken);

  useEffect(() => {
    let flushing = false;
    let rerunRequested = false;
    let cancelled = false;

    async function flushOnce() {
      const items = await getRetryableTeamActions();
      if (items.length === 0) return;

      let synced = 0;
      for (const item of items) {
        if (cancelled) return;
        try {
          await markTeamActionSyncing(item.clientActionId);
          await replayQueuedAction(item);
          await removeTeamAction(item.clientActionId);
          synced++;
          if (eventId) {
            setTeamSyncedAt(eventId, item.teamId, new Date().toISOString());
          }
        } catch {
          await markTeamActionFailed(item.clientActionId);
        }
      }

      if (synced > 0) {
        addToast({
          level: 'info',
          message: `${synced} handling${synced === 1 ? '' : 'er'} synkronisert`,
          autoDismissMs: 4_000,
        });
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
  }, [accessToken, addToast, eventId, setTeamSyncedAt]);
}
