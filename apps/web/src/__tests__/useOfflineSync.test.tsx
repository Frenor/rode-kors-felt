import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useOfflineSync } from '../hooks/useOfflineSync';

describe('useOfflineSync', () => {
  it('is a no-op hook (incident queue has been removed)', () => {
    // The hook used to flush an offline incident queue.
    // Incident management has been removed — the hook is now a stub.
    // This test just verifies it can be rendered without throwing.
    const { unmount } = renderHook(() => useOfflineSync());
    expect(() => unmount()).not.toThrow();
  });
});

