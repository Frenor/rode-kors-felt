import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { SickBayHeader } from '../pages/SickBay/SickBayHeader';
import { offlineSickbayQueueDb } from '../lib/offline-sickbay-queue';

describe('SickBayHeader — attention summary', () => {
  it('shows nothing urgent when there is no overdue or continuous-monitoring patient', () => {
    render(<SickBayHeader onNewPatient={vi.fn()} />);
    expect(screen.queryByTestId('sickbay-attention-summary')).not.toBeInTheDocument();
    expect(screen.getByText('Ingen forfalte vurderinger')).toBeInTheDocument();
  });

  it('joins overdue and continuous counts into one critical line', () => {
    render(<SickBayHeader onNewPatient={vi.fn()} overdueCount={2} continuousCount={1} />);
    expect(screen.getByTestId('sickbay-attention-summary')).toHaveTextContent('2 forfalt vurdering · 1 kontinuerlig overvåkning');
  });
});

describe('SickBayHeader — occupancy strip (item 8.30)', () => {
  it('shows "Kapasitet ikke satt" when no capacity is configured', () => {
    render(<SickBayHeader onNewPatient={vi.fn()} occupancy={{ chairs: null, beds: null }} />);
    expect(screen.getByTestId('sickbay-occupancy')).toHaveTextContent('Kapasitet ikke satt');
  });

  it('renders occupied/total for both chairs and beds', () => {
    render(<SickBayHeader onNewPatient={vi.fn()} occupancy={{ chairs: { occupied: 3, total: 16 }, beds: { occupied: 1, total: 4 } }} />);
    expect(screen.getByTestId('sickbay-occupancy')).toHaveTextContent('Stoler 3/16 · Senger 1/4');
  });

  it('renders only the configured type, never inventing the other', () => {
    render(<SickBayHeader onNewPatient={vi.fn()} occupancy={{ chairs: { occupied: 3, total: 16 }, beds: null }} />);
    const el = screen.getByTestId('sickbay-occupancy');
    expect(el).toHaveTextContent('Stoler 3/16');
    expect(el).not.toHaveTextContent('Senger');
    expect(el).not.toHaveTextContent('Kapasitet ikke satt');
  });

  it('shows "Kapasitet ikke satt" when the occupancy prop is entirely omitted', () => {
    render(<SickBayHeader onNewPatient={vi.fn()} />);
    expect(screen.getByTestId('sickbay-occupancy')).toHaveTextContent('Kapasitet ikke satt');
  });
});

describe('SickBayHeader — offline queue status (item 8.27)', () => {
  beforeEach(async () => {
    await offlineSickbayQueueDb.queue.clear();
  });

  afterEach(async () => {
    await offlineSickbayQueueDb.queue.clear();
  });

  it('renders nothing when the queue is empty', async () => {
    render(<SickBayHeader onNewPatient={vi.fn()} />);
    await waitFor(() => {
      expect(screen.queryByTestId('sickbay-queue-status')).not.toBeInTheDocument();
    });
  });

  it('shows "N venter på sending" for pending/syncing items', async () => {
    await offlineSickbayQueueDb.queue.bulkPut([
      { clientActionId: 'a1', patientId: 'p1', payload: { type: 'status_set', status: 'observation' }, status: 'pending', queuedAt: new Date().toISOString() },
      { clientActionId: 'a2', patientId: 'p1', payload: { type: 'note_add', text: 'x', author: 'y' }, status: 'syncing', queuedAt: new Date().toISOString() },
    ]);

    render(<SickBayHeader onNewPatient={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByTestId('sickbay-queue-status')).toHaveTextContent('2 venter på sending');
    });
  });

  it('shows "N ikke sendt" for failed items, alongside a pending count', async () => {
    await offlineSickbayQueueDb.queue.bulkPut([
      { clientActionId: 'a1', patientId: 'p1', payload: { type: 'status_set', status: 'observation' }, status: 'pending', queuedAt: new Date().toISOString() },
      { clientActionId: 'a2', patientId: 'p1', payload: { type: 'note_add', text: 'x', author: 'y' }, status: 'failed', queuedAt: new Date().toISOString() },
    ]);

    render(<SickBayHeader onNewPatient={vi.fn()} />);
    await waitFor(() => {
      const el = screen.getByTestId('sickbay-queue-status');
      expect(el).toHaveTextContent('1 venter på sending');
      expect(el).toHaveTextContent('1 ikke sendt');
    });
  });
});
