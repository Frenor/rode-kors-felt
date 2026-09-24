/**
 * ArchiveEventCard — retention (gap B8 / item 8.33) gating.
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ArchiveEventCard } from '../pages/Coordinator/ArchiveEventCard';

describe('ArchiveEventCard', () => {
  it('disables "Anonymiser" until journals are exported and the name is confirmed', () => {
    render(
      <ArchiveEventCard
        eventName="Holmenkollen Skimaraton 2026"
        eventStatus="archived"
        onExportJournals={vi.fn().mockResolvedValue(3)}
        onAnonymise={vi.fn()}
      />,
    );
    expect(screen.getByTestId('archive-anonymise')).toBeDisabled();
  });

  it('enables "Anonymiser" once both step 1 (export) and step 2 (typed name) are done', async () => {
    const onExportJournals = vi.fn().mockResolvedValue(5);
    render(
      <ArchiveEventCard
        eventName="Holmenkollen Skimaraton 2026"
        eventStatus="archived"
        onExportJournals={onExportJournals}
        onAnonymise={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId('archive-export'));
    await waitFor(() => expect(onExportJournals).toHaveBeenCalled());
    await screen.findByText(/5 journaler eksportert/);
    expect(screen.getByTestId('archive-anonymise')).toBeDisabled();

    fireEvent.change(screen.getByTestId('archive-confirm-input'), { target: { value: 'Wrong name' } });
    expect(screen.getByTestId('archive-anonymise')).toBeDisabled();

    fireEvent.change(screen.getByTestId('archive-confirm-input'), { target: { value: 'Holmenkollen Skimaraton 2026' } });
    expect(screen.getByTestId('archive-anonymise')).toBeEnabled();
  });

  it('stays disabled with an explanation while the event is still active, even with both steps done', async () => {
    const onExportJournals = vi.fn().mockResolvedValue(1);
    render(
      <ArchiveEventCard
        eventName="Test Event"
        eventStatus="active"
        onExportJournals={onExportJournals}
        onAnonymise={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId('archive-export'));
    await waitFor(() => expect(onExportJournals).toHaveBeenCalled());
    fireEvent.change(screen.getByTestId('archive-confirm-input'), { target: { value: 'Test Event' } });

    expect(screen.getByTestId('archive-anonymise')).toBeDisabled();
    expect(screen.getByText(/fortsatt aktivt/)).toBeInTheDocument();
  });

  it('calls onAnonymise and shows the result once all gates pass', async () => {
    const onAnonymise = vi.fn().mockResolvedValue({ anonymisedAt: '2026-09-23T14:05:00Z', alreadyAnonymised: false, patientsAnonymised: 4 });
    render(
      <ArchiveEventCard
        eventName="Test Event"
        eventStatus="archived"
        onExportJournals={vi.fn().mockResolvedValue(2)}
        onAnonymise={onAnonymise}
      />,
    );
    fireEvent.click(screen.getByTestId('archive-export'));
    await screen.findByText(/2 journaler eksportert/);
    fireEvent.change(screen.getByTestId('archive-confirm-input'), { target: { value: 'Test Event' } });
    fireEvent.click(screen.getByTestId('archive-anonymise'));

    await waitFor(() => expect(onAnonymise).toHaveBeenCalled());
    expect(await screen.findByTestId('archive-result')).toHaveTextContent('4 pasienter');
  });

  it('shows the result immediately when the event is already anonymised', () => {
    render(
      <ArchiveEventCard
        eventName="Test Event"
        eventStatus="archived"
        anonymisedAt="2026-09-23T09:00:00Z"
        onExportJournals={vi.fn()}
        onAnonymise={vi.fn()}
      />,
    );
    expect(screen.getByTestId('archive-result')).toBeInTheDocument();
    expect(screen.queryByTestId('archive-anonymise')).not.toBeInTheDocument();
  });

  it('shows a visible error line when the anonymise call fails', async () => {
    const onAnonymise = vi.fn().mockRejectedValue(new Error('Arrangementet er fortsatt aktivt'));
    render(
      <ArchiveEventCard
        eventName="Test Event"
        eventStatus="archived"
        onExportJournals={vi.fn().mockResolvedValue(1)}
        onAnonymise={onAnonymise}
      />,
    );
    fireEvent.click(screen.getByTestId('archive-export'));
    await screen.findByText(/1 journal eksportert/);
    fireEvent.change(screen.getByTestId('archive-confirm-input'), { target: { value: 'Test Event' } });
    fireEvent.click(screen.getByTestId('archive-anonymise'));

    expect(await screen.findByRole('alert')).toHaveTextContent('Arrangementet er fortsatt aktivt');
  });
});
