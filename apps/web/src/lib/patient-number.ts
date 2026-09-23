/**
 * Shared patient number (gap A5).
 *
 * Every patient gets a stable, human-facing number (`#12`) allocated once by
 * the API (or the demo store) at creation time. This is the single place
 * that formats it — never build the `#<n>` string inline.
 */
export function patientNumber(p: { seq?: number | null }): string | null {
  if (typeof p.seq !== 'number' || !Number.isFinite(p.seq)) return null;
  return `#${p.seq}`;
}
