import { useEffect } from 'react';
import { api } from '../lib/api';
import {
  getRetryableTeamActions,
  markTeamActionFailed,
  markTeamActionSyncing,
  removeTeamAction,
} from '../lib/offline-firstaid-queue';
import { useNotificationStore } from '../stores/notifications';
import { useFirstAidWorkspaceStore } from '../stores/firstaid-workspace';
import { useAuthStore } from '../stores/auth';

export function useOfflineTeamSync() {
  const addToast = useNotificationStore((s) => s.add);
  const setTeamSyncedAt = useFirstAidWorkspaceStore((s) => s.setTeamSyncedAt);
  const eventId = useAuthStore((s) => s.eventId);

  useEffect(() => {
    async function flush() {
      const items = await getRetryableTeamActions();
      if (items.length === 0) return;

      let synced = 0;
      for (const item of items) {
        try {
          await markTeamActionSyncing(item.clientActionId);
          await api.postTeamAction(item.teamId, item.payload, { skipOfflineQueue: true });
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
          message: `${synced} laghandling${synced === 1 ? '' : 'er'} synkronisert`,
          autoDismissMs: 4_000,
        });
      }
    }

    window.addEventListener('online', flush);
    window.addEventListener('rkf:wsConnected', flush);

    return () => {
      window.removeEventListener('online', flush);
      window.removeEventListener('rkf:wsConnected', flush);
    };
  }, [addToast, eventId, setTeamSyncedAt]);
}
