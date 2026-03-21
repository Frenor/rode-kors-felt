/**
 * One-shot GPS hook — acquires position once on mount.
 */

import { useState, useEffect } from 'react';

export interface GeoPosition {
  lat: number;
  lng: number;
}

export type GeolocationStatus = 'idle' | 'acquiring' | 'ok' | 'denied' | 'unavailable';

export function useGeolocation(): { position: GeoPosition | null; status: GeolocationStatus } {
  const [position, setPosition] = useState<GeoPosition | null>(null);
  const [status, setStatus] = useState<GeolocationStatus>('idle');

  useEffect(() => {
    if (!navigator.geolocation) {
      setStatus('unavailable');
      return;
    }

    setStatus('acquiring');

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setStatus('ok');
      },
      (err) => {
        setStatus(err.code === GeolocationPositionError.PERMISSION_DENIED ? 'denied' : 'unavailable');
      },
      { timeout: 10000, maximumAge: 30000 },
    );
  }, []);

  return { position, status };
}
