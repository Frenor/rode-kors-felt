/**
 * Persisted "Koordinator har tildelt dere: …" banner state (gap A4).
 *
 * A patient id enters this set the moment a `patient.updated` message
 * assigns it to this team for the first time; it leaves when the patrol
 * acts ("Vi drar" or "Kan ikke"). Stored per event+team in localStorage so a
 * phone that reloads — or was locked when the assignment came in — still
 * shows the banner until someone actually answers it.
 */

const storageKey = (eventId: string, teamId: string) => `rkf-pending-assignments:${eventId}:${teamId}`;

export function loadPendingAssignments(eventId: string, teamId: string): string[] {
  try {
    const raw = localStorage.getItem(storageKey(eventId, teamId));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    // Private browsing, corrupted value, storage disabled — start clean
    // rather than crash the workspace over a convenience feature.
    return [];
  }
}

function savePendingAssignments(eventId: string, teamId: string, ids: string[]): void {
  try {
    localStorage.setItem(storageKey(eventId, teamId), JSON.stringify(ids));
  } catch {
    // Best-effort only.
  }
}

/** Adds a patient id if it is not already pending; returns the new list. */
export function addPendingAssignment(eventId: string, teamId: string, patientId: string): string[] {
  const current = loadPendingAssignments(eventId, teamId);
  if (current.includes(patientId)) return current;
  const next = [...current, patientId];
  savePendingAssignments(eventId, teamId, next);
  return next;
}

/** Removes a patient id once the patrol has acted; returns the new list. */
export function removePendingAssignment(eventId: string, teamId: string, patientId: string): string[] {
  const current = loadPendingAssignments(eventId, teamId);
  const next = current.filter((id) => id !== patientId);
  if (next.length !== current.length) savePendingAssignments(eventId, teamId, next);
  return next;
}
