import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EventMap } from '../components/EventMap';

vi.mock('leaflet', () => ({
  default: {
    divIcon: vi.fn(() => ({})),
  },
}));

vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="leaflet-map">{children}</div>,
  TileLayer: ({ url }: { url: string }) => <div data-testid="leaflet-tile">{url}</div>,
  Marker: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Popup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useMap: () => ({ fitBounds: vi.fn() }),
}));

interface TestMapInstance {
  on: ReturnType<typeof vi.fn>;
  off: ReturnType<typeof vi.fn>;
  remove: ReturnType<typeof vi.fn>;
  addControl: ReturnType<typeof vi.fn>;
  fitBounds: ReturnType<typeof vi.fn>;
  getSource: ReturnType<typeof vi.fn>;
  addSource: ReturnType<typeof vi.fn>;
  getLayer: ReturnType<typeof vi.fn>;
  addLayer: ReturnType<typeof vi.fn>;
  setPitch: ReturnType<typeof vi.fn>;
  setBearing: ReturnType<typeof vi.fn>;
}

function createMapLibreRuntime() {
  const loadHandlers = new Set<() => void>();

  const mapInstance: TestMapInstance = {
    on: vi.fn((event: string, cb: () => void) => {
      if (event === 'load') {
        loadHandlers.add(cb);
      }
    }),
    off: vi.fn((event: string, cb: () => void) => {
      if (event === 'load') {
        loadHandlers.delete(cb);
      }
    }),
    remove: vi.fn(),
    addControl: vi.fn(),
    fitBounds: vi.fn(),
    getSource: vi.fn(() => null),
    addSource: vi.fn(),
    getLayer: vi.fn(() => null),
    addLayer: vi.fn(),
    setPitch: vi.fn(),
    setBearing: vi.fn(),
  };

  const Map = vi.fn(() => mapInstance);
  const NavigationControl = vi.fn(() => ({}));
  const Popup = vi.fn(() => ({ setHTML: vi.fn().mockReturnThis() }));
  const Marker = vi.fn(() => ({
    setLngLat: vi.fn().mockReturnThis(),
    setPopup: vi.fn().mockReturnThis(),
    addTo: vi.fn().mockReturnThis(),
    remove: vi.fn(),
  }));

  return {
    runtime: { Map, NavigationControl, Popup, Marker },
    mapInstance,
    triggerLoad: () => {
      loadHandlers.forEach((handler) => handler());
    },
  };
}

describe('EventMap MapLibre hardening', () => {
  beforeEach(() => {
    delete (window as Window & { maplibregl?: unknown }).maplibregl;
    document.head.querySelectorAll('script#rkf-maplibre-runtime').forEach((node) => node.remove());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('loads MapLibre runtime when window.maplibregl is not preloaded', async () => {
    const { runtime } = createMapLibreRuntime();

    render(
      <EventMap
        teams={[]}
        mapRuntimeConfig={{ provider: 'maplibre' }}
      />,
    );

    const runtimeScript = document.head.querySelector<HTMLScriptElement>('#rkf-maplibre-runtime');
    expect(runtimeScript).toBeTruthy();

    await act(async () => {
      (window as Window & { maplibregl?: unknown }).maplibregl = runtime;
      runtimeScript?.onload?.(new Event('load'));
    });

    await waitFor(() => expect(runtime.Map).toHaveBeenCalledTimes(1));
    expect(screen.queryByTestId('leaflet-map')).not.toBeInTheDocument();
  });

  it('consumes configured raster layers in MapLibre mode', async () => {
    const { runtime, mapInstance, triggerLoad } = createMapLibreRuntime();
    (window as Window & { maplibregl?: unknown }).maplibregl = runtime;

    render(
      <EventMap
        teams={[]}
        mapRuntimeConfig={{
          provider: 'maplibre',
          layers: [{ id: 'overlay', type: 'xyz', url: 'https://tiles.example.com/{z}/{x}/{y}.png' }],
        }}
      />,
    );

    await waitFor(() => expect(runtime.Map).toHaveBeenCalledTimes(1));
    act(() => triggerLoad());

    expect(mapInstance.addSource).toHaveBeenCalledWith(
      'rkf-overlay-source-overlay',
      expect.objectContaining({
        type: 'raster',
        tiles: ['https://tiles.example.com/{z}/{x}/{y}.png'],
      }),
    );
    expect(mapInstance.addLayer).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'rkf-overlay-layer-overlay',
        type: 'raster',
        source: 'rkf-overlay-source-overlay',
      }),
    );
  });

  it('applies 3D toggle updates in MapLibre mode', async () => {
    const { runtime, mapInstance } = createMapLibreRuntime();
    (window as Window & { maplibregl?: unknown }).maplibregl = runtime;

    const { rerender } = render(
      <EventMap
        teams={[]}
        presentation3d={false}
        mapRuntimeConfig={{ provider: 'maplibre' }}
      />,
    );

    await waitFor(() => expect(runtime.Map).toHaveBeenCalledTimes(1));

    rerender(
      <EventMap
        teams={[]}
        presentation3d
        mapRuntimeConfig={{ provider: 'maplibre' }}
      />,
    );

    await waitFor(() => expect(mapInstance.setPitch).toHaveBeenCalledWith(55));
    expect(mapInstance.setBearing).toHaveBeenCalledWith(18);
  });
});
