import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EventMap } from '../components/EventMap';

vi.mock('leaflet', () => ({
  default: {
    divIcon: vi.fn(() => ({ mocked: true })),
  },
}));

vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="leaflet-map">{children}</div>,
  TileLayer: () => null,
  Marker: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Popup: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  useMap: () => ({ fitBounds: vi.fn() }),
}));

type MaplibreRuntime = {
  Map: new (options: Record<string, unknown>) => {
    addControl: (control: unknown, position?: string) => void;
    fitBounds: (bounds: [[number, number], [number, number]], options?: Record<string, unknown>) => void;
    setPitch: (pitch: number) => void;
    setBearing: (bearing: number) => void;
    remove: () => void;
  };
  NavigationControl: new () => unknown;
  Marker: new () => {
    setLngLat: (coords: [number, number]) => any;
    setPopup: (popup: unknown) => any;
    addTo: (map: unknown) => any;
    remove: () => void;
  };
  Popup: new () => {
    setHTML: (html: string) => any;
  };
};

const baseProps = {
  incidents: [
    {
      id: 'inc-1',
      type: 'medisinsk',
      status: 'active',
      location: { lat: 59.91, lng: 10.75 },
      createdAt: '2026-03-20T12:00:00.000Z',
    },
  ],
  teams: [],
  onIncidentClick: vi.fn(),
};

const setPitch = vi.fn();
const setBearing = vi.fn();

function installMaplibreRuntime() {
  const mapInstance = {
    addControl: vi.fn(),
    fitBounds: vi.fn(),
    setPitch,
    setBearing,
    remove: vi.fn(),
  };

  class MockMap {
    constructor(_options: Record<string, unknown>) {
      return mapInstance;
    }
  }

  class MockNavigationControl {}

  class MockMarker {
    setLngLat() {
      return this;
    }
    setPopup() {
      return this;
    }
    addTo() {
      return this;
    }
    remove() {}
  }

  class MockPopup {
    setHTML() {
      return this;
    }
  }

  const runtime: MaplibreRuntime = {
    Map: MockMap as unknown as MaplibreRuntime['Map'],
    NavigationControl: MockNavigationControl,
    Marker: MockMarker as unknown as MaplibreRuntime['Marker'],
    Popup: MockPopup as unknown as MaplibreRuntime['Popup'],
  };

  Object.defineProperty(window, 'maplibregl', {
    value: runtime,
    configurable: true,
  });
}

beforeEach(() => {
  setPitch.mockReset();
  setBearing.mockReset();
  delete (window as Window & { maplibregl?: unknown }).maplibregl;
});

afterEach(() => {
  delete (window as Window & { maplibregl?: unknown }).maplibregl;
});

describe('EventMap runtime safety', () => {
  it('falls back to Leaflet when MapLibre runtime is missing', () => {
    render(<EventMap {...baseProps} provider="maplibre" presentation3d />);

    expect(screen.getByTestId('leaflet-map')).toBeInTheDocument();
    expect(screen.getByText(/3D-presentasjon aktiv/i)).toBeInTheDocument();
  });

  it('updates pitch and bearing safely when 3D is toggled with MapLibre runtime present', () => {
    installMaplibreRuntime();

    const { rerender } = render(<EventMap {...baseProps} provider="maplibre" presentation3d={false} />);

    rerender(<EventMap {...baseProps} provider="maplibre" presentation3d />);

    expect(setPitch).toHaveBeenCalledWith(55);
    expect(setBearing).toHaveBeenCalledWith(18);
  });
});
