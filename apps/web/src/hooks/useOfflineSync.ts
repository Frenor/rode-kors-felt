/**
 * Flushes the offline incident queue when the browser comes back online
 * OR when the WebSocket reconnects after a drop (rkf:wsConnected event).
 *
 * Shows a toast with the number of synced items on successful flush.
 */

import { useEffect } from 'react';
import { api } from '../lib/api';
import { getRetryableItems, markSyncing, markFailed, removeItem } from '../lib/offline-queue';
import { useNotificationStore } from '../stores/notifications';

export function useOfflineSync() {
  const addToast = useNotificationStore((s) => s.add);

  useEffect(() => {
    async function flush() {
      const items = await getRetryableItems();
      if (items.length === 0) return;

      let synced = 0;
      for (const item of items) {
        try {
          await markSyncing(item.clientId);
          await api.createIncident(item.payload as Parameters<typeof api.createIncident>[0]);
          await removeItem(item.clientId);
          synced++;
        } catch {
          await markFailed(item.clientId);
        }
      }

      if (synced > 0) {
        addToast({
          level: 'info',
          message: `${synced} hendelse${synced === 1 ? '' : 'r'} synkronisert`,
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
  }, [addToast]);
}
