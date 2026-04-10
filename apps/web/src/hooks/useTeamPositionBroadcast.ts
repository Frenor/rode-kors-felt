/**
 * Broadcasts the team's GPS position every 30 seconds via WebSocket.
 * Silently no-ops if geolocation is denied or WS is not connected.
 *
 * Each device gets a stable random `memberId` (persisted in localStorage) so
 * the coordinator can track individual team members when multiple people on
 * the same team are broadcasting their location.
 */

import { useEffect } from 'react';
import { useWsStore } from '../stores/ws';
import { useAuthStore } from '../stores/auth';

const INTERVAL_MS = 30_000;
const DEVICE_ID_KEY = 'rkf-device-id';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function getOrCreateDeviceId(): string {
  try {
    const stored = localStorage.getItem(DEVICE_ID_KEY);
    if (stored && UUID_RE.test(stored)) return stored;
    const id = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_KEY, id);
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

export function useTeamPositionBroadcast(teamId: string | null) {
  const send = useWsStore((s) => s.send);
  const status = useWsStore((s) => s.status);
  const eventId = useAuthStore((s) => s.eventId);

  useEffect(() => {
    if (!teamId || !eventId || status !== 'connected') return;
    if (!navigator.geolocation) return;

    const memberId = getOrCreateDeviceId();

    function broadcast() {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          send({
            type: 'team.position',
            eventId: eventId!,
            payload: {
              teamId,
              position: { lat: pos.coords.latitude, lng: pos.coords.longitude },
              memberId,
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
