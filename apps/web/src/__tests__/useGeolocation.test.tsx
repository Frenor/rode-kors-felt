import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useGeolocation } from '../hooks/useGeolocation';

type SuccessCb = (pos: GeolocationPosition) => void;
type ErrorCb = (err: GeolocationPositionError) => void;

function installGeolocationMock() {
  let success: SuccessCb | null = null;
  let error: ErrorCb | null = null;
  const clearWatch = vi.fn();
  const watchPosition = vi.fn((s: SuccessCb, e: ErrorCb) => {
    success = s;
    error = e;
    return 42;
  });
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: { watchPosition, clearWatch, getCurrentPosition: vi.fn() },
  });
  return {
    watchPosition,
    clearWatch,
    emit: (lat: number, lng: number, accuracy = 5) =>
      success?.({ coords: { latitude: lat, longitude: lng, accuracy } } as GeolocationPosition),
    fail: (code: number) =>
      error?.({ code, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 } as GeolocationPositionError),
  };
}

afterEach(() => {
  // @ts-expect-error — restore to jsdom default (undefined)
  delete navigator.geolocation;
});

describe('useGeolocation', () => {
  it('keeps the position fresh with watchPosition and clears the watch on unmount', () => {
    const geo = installGeolocationMock();
    const { result, unmount } = renderHook(() => useGeolocation());

    expect(geo.watchPosition).toHaveBeenCalledOnce();
    expect(result.current.status).toBe('acquiring');

    act(() => geo.emit(59.9, 10.7, 8));
    expect(result.current.position).toEqual({ lat: 59.9, lng: 10.7 });
    expect(result.current.accuracy).toBe(8);
    expect(result.current.status).toBe('ok');
    const firstUpdate = result.current.updatedAt;

    act(() => geo.emit(59.91, 10.71, 4));
    expect(result.current.position).toEqual({ lat: 59.91, lng: 10.71 });
    expect(result.current.updatedAt).toBeGreaterThanOrEqual(firstUpdate!);

    unmount();
    expect(geo.clearWatch).toHaveBeenCalledWith(42);
  });

  it('reports denied permission without dropping to unavailable', () => {
    const geo = installGeolocationMock();
    const { result } = renderHook(() => useGeolocation());

    act(() => geo.fail(1));
    expect(result.current.status).toBe('denied');
    expect(result.current.position).toBeNull();
  });

  it('keeps the last fix when a transient error follows a good position', () => {
    const geo = installGeolocationMock();
    const { result } = renderHook(() => useGeolocation());

    act(() => geo.emit(59.9, 10.7));
    act(() => geo.fail(3));
    expect(result.current.position).toEqual({ lat: 59.9, lng: 10.7 });
    expect(result.current.status).toBe('ok');
  });

  it('reports unavailable when the browser has no geolocation API', () => {
    const { result } = renderHook(() => useGeolocation());
    expect(result.current.status).toBe('unavailable');
  });
});
