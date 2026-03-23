/**
 * NewTaskModal — modal for creating a new coordinator task/incident.
 */

import { FocusTrap } from '../../components/FocusTrap';
import { typeLabels } from '../../lib/constants';
import type { Team } from '../../lib/types';

interface NewTaskModalProps {
  type: string;
  teamId: string;
  note: string;
  teams: Team[];
  creating: boolean;
  onTypeChange: (t: string) => void;
  onTeamChange: (id: string) => void;
  onNoteChange: (n: string) => void;
  onSubmit: () => void;
  onClose: () => void;
}

export function NewTaskModal({
  type,
  teamId,
  note,
  teams,
  creating,
  onTypeChange,
  onTeamChange,
  onNoteChange,
  onSubmit,
  onClose,
}: NewTaskModalProps) {
  return (
    <div
      role="dialog"
      aria-label="Nytt koordinatoroppdrag"
      aria-modal="true"
      style={{
        position: 'fixed', inset: 0, zIndex: 'var(--z-modal)' as React.CSSProperties['zIndex'],
        background: 'rgba(0,0,0,0.5)', display: 'flex',
        alignItems: 'center', justifyContent: 'center', padding: 'var(--space-4)',
      }}
    >
      <FocusTrap onEscape={onClose}>
        <div style={{
          background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-6)', maxWidth: 480, width: '100%',
        }}>
          <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, marginBottom: 'var(--space-1)' }}>
            Nytt koordinatoroppdrag
          </h2>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-5)' }}>
            Opprettet av koordinator — vises i hendelsesfeed og tildeles valgt lag.
          </p>

          {/* Type */}
          <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 'var(--space-2)' }}>
            Hendelsestype
          </label>
          <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', marginBottom: 'var(--space-4)' }}>
            {(['medical', 'trauma', 'psychiatric', 'other'] as const).map((t) => (
              <button
                key={t}
                onClick={() => onTypeChange(t)}
                style={{
                  padding: 'var(--space-2) var(--space-3)',
                  borderRadius: 'var(--radius-md)',
                  border: `2px solid ${type === t ? 'var(--color-brand)' : 'var(--color-border)'}`,
                  background: type === t ? 'var(--color-brand)' : 'transparent',
                  color: type === t ? 'white' : 'var(--color-text)',
                  fontWeight: type === t ? 700 : 400,
                  cursor: 'pointer', fontSize: 'var(--text-sm)',
                  minHeight: 'var(--touch-min)',
                }}
              >
                {typeLabels[t]}
              </button>
            ))}
          </div>

          {/* Team */}
          <label htmlFor="new-oppdrag-team" style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 'var(--space-2)' }}>
            Tildel lag (valgfritt)
          </label>
          <select
            id="new-oppdrag-team"
            value={teamId}
            onChange={(e) => onTeamChange(e.target.value)}
            style={{
              width: '100%', padding: 'var(--space-2) var(--space-3)',
              borderRadius: 'var(--radius-md)', border: '1px solid var(--color-input-border)',
              background: 'var(--color-input-bg)', color: 'var(--color-text)',
              fontSize: 'var(--text-sm)', marginBottom: 'var(--space-4)',
              minHeight: 'var(--touch-min)',
            }}
          >
            <option value="">— Velg lag —</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}{t.transport ? ` (${t.transport})` : ''}{t.currentPosition ? ' · GPS' : ''}
              </option>
            ))}
          </select>

          {/* Note */}
          <label htmlFor="new-oppdrag-note" style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 'var(--space-2)' }}>
            Sted / beskrivelse
          </label>
          <textarea
            id="new-oppdrag-note"
            value={note}
            onChange={(e) => onNoteChange(e.target.value)}
            placeholder="F.eks. «Sektor B ved inngang, person sitter på bakken»"
            rows={3}
            style={{
              width: '100%', padding: 'var(--space-2) var(--space-3)',
              borderRadius: 'var(--radius-md)', border: '1px solid var(--color-input-border)',
              background: 'var(--color-input-bg)', color: 'var(--color-text)',
              fontSize: 'var(--text-sm)', resize: 'vertical',
              marginBottom: 'var(--space-5)',
            }}
          />

          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <button
              onClick={onClose}
              style={{
                flex: 1, minHeight: 'var(--touch-min)', borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)', background: 'transparent', cursor: 'pointer',
              }}
            >
              Avbryt
            </button>
            <button
              onClick={onSubmit}
              disabled={creating}
              style={{
                flex: 2, minHeight: 'var(--touch-min)', borderRadius: 'var(--radius-md)',
                border: 'none', background: 'var(--color-brand)', color: 'white',
                fontWeight: 700, cursor: 'pointer',
              }}
            >
              {creating ? 'Oppretter...' : 'Opprett og tildel'}
            </button>
          </div>
        </div>
      </FocusTrap>
    </div>
  );
}
