/**
 * TeamsSetupPanel — event set-up (gap B5 / item 8.31): rename, retransport,
 * re-contact and stand teams up/down. Inline edits save on blur (text) or
 * immediately (select/toggle) — no separate edit mode, since a coordinator
 * setting up an event does this a handful of times, not constantly.
 */
import { useState, type FormEvent } from 'react';
import { TEAM_TRANSPORT_LABELS } from '../../lib/constants';
import { Button } from '../../components/ui';

interface SetupTeam {
  id: string;
  name: string;
  transport?: string;
  contactPhone?: string | null;
  contactRadio?: string | null;
  active?: boolean;
}

interface TeamsSetupPanelProps {
  teams: SetupTeam[];
  onCreateTeam: (data: { name: string; transport?: string; contactPhone?: string | null; contactRadio?: string | null }) => Promise<void>;
  onUpdateTeam: (teamId: string, data: Partial<{ name: string; transport: string; contactPhone: string | null; contactRadio: string | null; active: boolean }>) => Promise<void>;
}

const TRANSPORT_OPTIONS: Array<{ value: string; label: string }> = Object.entries(TEAM_TRANSPORT_LABELS).map(
  ([value, label]) => ({ value, label }),
);

const inputStyle = { minHeight: 44, fontSize: 'var(--text-sm)' };

function TeamRow({ team, onUpdate }: { team: SetupTeam; onUpdate: (data: Partial<{ name: string; transport: string; contactPhone: string | null; contactRadio: string | null; active: boolean }>) => Promise<void> }) {
  const [name, setName] = useState(team.name);
  const [contactRadio, setContactRadio] = useState(team.contactRadio ?? '');
  const [contactPhone, setContactPhone] = useState(team.contactPhone ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async (data: Partial<{ name: string; transport: string; contactPhone: string | null; contactRadio: string | null; active: boolean }>) => {
    setSaving(true);
    setError(null);
    try {
      await onUpdate(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunne ikke lagre laget');
    } finally {
      setSaving(false);
    }
  };

  return (
    <tr data-testid={`event-setup-team-${team.id}`} style={{ borderBottom: '1px solid var(--color-border)', opacity: team.active === false ? 0.55 : 1 }}>
      <td style={{ padding: 'var(--space-1) var(--space-2)' }}>
        <input
          className="field"
          style={{ ...inputStyle, width: 120 }}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => { if (name.trim() && name.trim() !== team.name) void save({ name: name.trim() }); }}
          aria-label={`Navn for ${team.name}`}
        />
      </td>
      <td style={{ padding: 'var(--space-1) var(--space-2)' }}>
        <select
          className="field"
          style={{ ...inputStyle, width: 130 }}
          value={team.transport ?? 'foot'}
          onChange={(e) => void save({ transport: e.target.value })}
          aria-label={`Transport for ${team.name}`}
        >
          {TRANSPORT_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </td>
      <td style={{ padding: 'var(--space-1) var(--space-2)' }}>
        <input
          className="field"
          style={{ ...inputStyle, width: 90 }}
          value={contactRadio}
          placeholder="ISSI"
          onChange={(e) => setContactRadio(e.target.value)}
          onBlur={() => { if (contactRadio !== (team.contactRadio ?? '')) void save({ contactRadio: contactRadio.trim() || null }); }}
          aria-label={`ISSI for ${team.name}`}
        />
      </td>
      <td style={{ padding: 'var(--space-1) var(--space-2)' }}>
        <input
          className="field"
          style={{ ...inputStyle, width: 120 }}
          value={contactPhone}
          placeholder="Telefon"
          onChange={(e) => setContactPhone(e.target.value)}
          onBlur={() => { if (contactPhone !== (team.contactPhone ?? '')) void save({ contactPhone: contactPhone.trim() || null }); }}
          aria-label={`Telefon for ${team.name}`}
        />
      </td>
      <td style={{ padding: 'var(--space-1) var(--space-2)' }}>
        <Button
          variant="ghost"
          size="sm"
          disabled={saving}
          data-testid={`event-setup-team-active-${team.id}`}
          onClick={() => void save({ active: !(team.active ?? true) })}
        >
          {team.active === false ? 'Inaktiv — gjør aktiv' : 'Aktiv'}
        </Button>
      </td>
      {error && (
        <td colSpan={5} style={{ padding: '0 var(--space-2) var(--space-1)' }}>
          <p role="alert" style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--color-status-critical)' }}>{error}</p>
        </td>
      )}
    </tr>
  );
}

export function TeamsSetupPanel({ teams, onCreateTeam, onUpdateTeam }: TeamsSetupPanelProps) {
  const [newName, setNewName] = useState('');
  const [newTransport, setNewTransport] = useState('foot');
  const [newRadio, setNewRadio] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    setCreateError(null);
    try {
      await onCreateTeam({
        name: newName.trim(),
        transport: newTransport,
        contactRadio: newRadio.trim() || null,
        contactPhone: newPhone.trim() || null,
      });
      setNewName('');
      setNewRadio('');
      setNewPhone('');
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Kunne ikke opprette laget');
    } finally {
      setCreating(false);
    }
  };

  return (
    <section
      aria-labelledby="teams-setup-title"
      data-testid="event-setup-teams"
      className="card"
      style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-4)' }}
    >
      <h2 id="teams-setup-title" className="section-label" style={{ margin: '0 0 var(--space-3)' }}>
        Lag
      </h2>

      {teams.length === 0 ? (
        <p style={{ margin: '0 0 var(--space-3)', fontSize: 'var(--text-sm)', color: 'var(--color-text-subtle)' }}>Ingen lag registrert ennå.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-3)' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--color-border)' }}>
              <th style={{ padding: 'var(--space-1) var(--space-2)' }}>Navn</th>
              <th style={{ padding: 'var(--space-1) var(--space-2)' }}>Transport</th>
              <th style={{ padding: 'var(--space-1) var(--space-2)' }}>ISSI</th>
              <th style={{ padding: 'var(--space-1) var(--space-2)' }}>Telefon</th>
              <th style={{ padding: 'var(--space-1) var(--space-2)' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {teams.map((team) => <TeamRow key={team.id} team={team} onUpdate={(data) => onUpdateTeam(team.id, data)} />)}
          </tbody>
        </table>
      )}

      <form onSubmit={(e) => void handleCreate(e)} style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', alignItems: 'flex-end' }}>
        <div>
          <label htmlFor="new-team-name" className="section-label" style={{ display: 'block', marginBottom: 4 }}>Nytt lag *</label>
          <input id="new-team-name" className="field" style={{ ...inputStyle, width: 140 }} value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="f.eks. Golf" />
        </div>
        <div>
          <label htmlFor="new-team-transport" className="section-label" style={{ display: 'block', marginBottom: 4 }}>Transport</label>
          <select id="new-team-transport" className="field" style={{ ...inputStyle, width: 130 }} value={newTransport} onChange={(e) => setNewTransport(e.target.value)}>
            {TRANSPORT_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="new-team-radio" className="section-label" style={{ display: 'block', marginBottom: 4 }}>ISSI</label>
          <input id="new-team-radio" className="field" style={{ ...inputStyle, width: 90 }} value={newRadio} onChange={(e) => setNewRadio(e.target.value)} />
        </div>
        <div>
          <label htmlFor="new-team-phone" className="section-label" style={{ display: 'block', marginBottom: 4 }}>Telefon</label>
          <input id="new-team-phone" className="field" style={{ ...inputStyle, width: 120 }} value={newPhone} onChange={(e) => setNewPhone(e.target.value)} />
        </div>
        <Button type="submit" variant="secondary" icon="plus" disabled={creating || !newName.trim()} data-testid="event-setup-team-add">
          {creating ? 'Legger til…' : 'Legg til lag'}
        </Button>
      </form>
      {createError && (
        <p role="alert" style={{ margin: 'var(--space-2) 0 0', fontSize: 'var(--text-sm)', color: 'var(--color-status-critical)' }}>{createError}</p>
      )}
    </section>
  );
}
