/**
 * Broadcasts the team's GPS position every 30 seconds via WebSocket.
 * Silently no-ops if geolocation is denied or WS is not connected.
 */

import { useEffect } from 'react';
import { useWsStore } from '../stores/ws';
import { useAuthStore } from '../stores/auth';

const INTERVAL_MS = 30_000;

export function useTeamPositionBroadcast(teamId: string | null) {
  const send = useWsStore((s) => s.send);
  const status = useWsStore((s) => s.status);
  const eventId = useAuthStore((s) => s.eventId);

  useEffect(() => {
    if (!teamId || !eventId || status !== 'connected') return;
    if (!navigator.geolocation) return;

    function broadcast() {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          send({
            type: 'team.position',
            eventId: eventId!,
            payload: {
              teamId,
              position: { lat: pos.coords.latitude, lng: pos.coords.longitude },
            },
          });
        },
        () => {
          // silently skip if denied
        },
        { timeout: 8000, maximumAge: 60000 },
      );
    }

    broadcast(); // fire immediately
    const interval = setInterval(broadcast, INTERVAL_MS);
    return () => clearInterval(interval);
  }, [teamId, eventId, status, send]);
}
