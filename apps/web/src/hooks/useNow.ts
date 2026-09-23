import { useEffect, useState } from 'react';

/**
 * A clock that re-renders on an interval, for "due in 12 min" style text that
 * must stay honest while the tablet sits untouched between patients.
 */
export function useNow(intervalMs = 30_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
