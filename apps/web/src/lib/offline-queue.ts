/**
 * @deprecated Incident offline queue — kept as a stub so existing test mocks
 * continue to resolve. The queue is no longer used in production code.
 * Remove this file when all test references are cleaned up.
 */

export async function enqueue(_payload: Record<string, unknown>): Promise<string> {
  return 'noop';
}
