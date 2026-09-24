/**
 * TeamsSetupPanel — event set-up (gap B5 / item 8.31): add, inline-edit, deactivate.
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TeamsSetupPanel } from '../pages/Coordinator/TeamsSetupPanel';

const TEAMS = [
  { id: 't-alpha', name: 'Alpha', transport: 'foot', contactPhone: null, contactRadio: null, active: true },
  { id: 't-hidden', name: 'Hidden', transport: 'bike', contactPhone: null, contactRadio: null, active: false },
];

describe('TeamsSetupPanel', () => {
  it('shows inactive teams muted, alongside active ones', () => {
    render(<TeamsSetupPanel teams={TEAMS} onCreateTeam={vi.fn()} onUpdateTeam={vi.fn()} />);
    expect(screen.getByTestId('event-setup-team-t-alpha')).toBeInTheDocument();
    const hiddenRow = screen.getByTestId('event-setup-team-t-hidden');
    expect(hiddenRow).toHaveStyle({ opacity: '0.55' });
  });

  it('creates a team with the form values', async () => {
    const onCreateTeam = vi.fn().mockResolvedValue(undefined);
    render(<TeamsSetupPanel teams={[]} onCreateTeam={onCreateTeam} onUpdateTeam={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('Nytt lag *'), { target: { value: 'Golf' } });
    fireEvent.change(screen.getByLabelText('Transport'), { target: { value: 'atv' } });
    fireEvent.change(screen.getByLabelText('ISSI'), { target: { value: '12345' } });
    fireEvent.click(screen.getByTestId('event-setup-team-add'));

    await waitFor(() => expect(onCreateTeam).toHaveBeenCalledWith({
      name: 'Golf', transport: 'atv', contactRadio: '12345', contactPhone: null,
    }));
  });

  it('saves a transport change immediately', async () => {
    const onUpdateTeam = vi.fn().mockResolvedValue(undefined);
    render(<TeamsSetupPanel teams={TEAMS} onCreateTeam={vi.fn()} onUpdateTeam={onUpdateTeam} />);
    fireEvent.change(screen.getByLabelText('Transport for Alpha'), { target: { value: 'vehicle' } });
    await waitFor(() => expect(onUpdateTeam).toHaveBeenCalledWith('t-alpha', { transport: 'vehicle' }));
  });

  it('saves a renamed team on blur', async () => {
    const onUpdateTeam = vi.fn().mockResolvedValue(undefined);
    render(<TeamsSetupPanel teams={TEAMS} onCreateTeam={vi.fn()} onUpdateTeam={onUpdateTeam} />);
    const nameInput = screen.getByLabelText('Navn for Alpha');
    fireEvent.change(nameInput, { target: { value: 'Alpha 2' } });
    fireEvent.blur(nameInput);
    await waitFor(() => expect(onUpdateTeam).toHaveBeenCalledWith('t-alpha', { name: 'Alpha 2' }));
  });

  it('toggles a team active/inactive', async () => {
    const onUpdateTeam = vi.fn().mockResolvedValue(undefined);
    render(<TeamsSetupPanel teams={TEAMS} onCreateTeam={vi.fn()} onUpdateTeam={onUpdateTeam} />);
    fireEvent.click(screen.getByTestId('event-setup-team-active-t-alpha'));
    await waitFor(() => expect(onUpdateTeam).toHaveBeenCalledWith('t-alpha', { active: false }));
  });

  it('shows a visible error line when creating a team fails', async () => {
    const onCreateTeam = vi.fn().mockRejectedValue(new Error('Nettverksfeil'));
    render(<TeamsSetupPanel teams={[]} onCreateTeam={onCreateTeam} onUpdateTeam={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Nytt lag *'), { target: { value: 'Golf' } });
    fireEvent.click(screen.getByTestId('event-setup-team-add'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Nettverksfeil');
  });
});
