/**
 * Flushes the offline incident queue when the browser comes back online.
 */

import { useEffect } from 'react';
import { api } from '../lib/api';
import { getPendingItems, markSyncing, markFailed, removeItem } from '../lib/offline-queue';

export function useOfflineSync() {
  useEffect(() => {
    async function flush() {
      const items = await getPendingItems();
      for (const item of items) {
        try {
          await markSyncing(item.clientId);
          await api.createIncident(item.payload as Parameters<typeof api.createIncident>[0]);
          await removeItem(item.clientId);
        } catch {
          await markFailed(item.clientId);
        }
      }
    }

    window.addEventListener('online', flush);
    return () => window.removeEventListener('online', flush);
  }, []);
}
