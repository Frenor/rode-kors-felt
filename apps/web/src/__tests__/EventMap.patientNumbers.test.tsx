/**
 * EventMap — shared patient number on markers (gap A5 / item 8.19).
 *
 * Markers show `#<seq>`, the real per-event number, falling back to the
 * 1-based index among the pins on the map only when `seq` is missing.
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EventMap, resolvePatientSeq } from '../components/EventMap';

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
  useMapEvents: vi.fn(() => ({ getZoom: vi.fn(() => 13) })),
}));

describe('resolvePatientSeq', () => {
  it('uses the real seq when known', () => {
    expect(resolvePatientSeq(12, 0)).toBe(12);
  });

  it('falls back to the 1-based index only when seq is missing', () => {
    expect(resolvePatientSeq(null, 2)).toBe(3);
    expect(resolvePatientSeq(undefined, 4)).toBe(5);
  });
});

describe('EventMap patient markers', () => {
  it('shows the real patient number in the marker popup title, and falls back to the index otherwise', () => {
    render(
      <EventMap
        teams={[]}
        patients={[
          { id: 'p1', label: 'Bevisstløs person', triageStatus: 'red', lat: 59.96, lon: 10.66, seq: 12 },
          { id: 'p2', label: null, triageStatus: 'green', lat: 59.97, lon: 10.67, seq: null },
        ]}
      />,
    );
    // Real seq: title includes "#12" and the label.
    expect(screen.getByText('#12 · Bevisstløs person')).toBeInTheDocument();
    // Missing seq: falls back to the 1-based index among the two pins (→ #2).
    expect(screen.getByText('#2')).toBeInTheDocument();
  });
});
