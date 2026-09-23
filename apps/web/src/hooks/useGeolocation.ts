/**
 * Continuous GPS hook.
 *
 * Uses `watchPosition` so the position stays fresh for the whole time the
 * dashboard is open. The previous one-shot implementation acquired the
 * position once on mount, which meant a patient reported an hour later got
 * the coordinates of wherever the first aider stood when the app was opened.
 *
 * `updatedAt` and `accuracy` let the UI say how trustworthy the fix is.
 */

import { useState, useEffect } from 'react';

interface GeoPosition {
  lat: number;
  lng: number;
}

type GeolocationStatus = 'idle' | 'acquiring' | 'ok' | 'denied' | 'unavailable';

export interface GeolocationState {
  position: GeoPosition | null;
  status: GeolocationStatus;
  /** Horizontal accuracy in metres for the latest fix. */
  accuracy: number | null;
  /** Wall-clock time (ms) when the latest fix was received. */
  updatedAt: number | null;
}

/** A fix older than this is flagged as stale in the UI. */
export const GPS_STALE_AFTER_MS = 2 * 60_000;

export function useGeolocation(): GeolocationState {
  const [state, setState] = useState<GeolocationState>({
    position: null,
    status: 'idle',
    accuracy: null,
    updatedAt: null,
  });

  useEffect(() => {
    const geolocation = typeof navigator === 'undefined' ? undefined : navigator.geolocation;
    if (!geolocation) {
      setState((prev) => ({ ...prev, status: 'unavailable' }));
      return;
    }

    setState((prev) => ({ ...prev, status: prev.position ? prev.status : 'acquiring' }));

    const onSuccess = (pos: GeolocationPosition) => {
      setState({
        position: { lat: pos.coords.latitude, lng: pos.coords.longitude },
        status: 'ok',
        accuracy: Number.isFinite(pos.coords.accuracy) ? Math.round(pos.coords.accuracy) : null,
        updatedAt: Date.now(),
      });
    };

    const onError = (err: GeolocationPositionError) => {
      setState((prev) => ({
        ...prev,
        // Keep the last known fix on a transient error; only the status changes.
        status: err.code === err.PERMISSION_DENIED ? 'denied' : prev.position ? prev.status : 'unavailable',
      }));
    };

    const watchId = geolocation.watchPosition(onSuccess, onError, {
      enableHighAccuracy: true,
      timeout: 15_000,
      maximumAge: 10_000,
    });

    return () => geolocation.clearWatch(watchId);
  }, []);

  return state;
}
