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
      className="modal-backdrop"
    >
      <FocusTrap onEscape={onClose}>
        <div className="modal-content">
          <h2 className="text-lg fw-700 mb-1">
            Nytt koordinatoroppdrag
          </h2>
          <p className="text-sm text-muted" style={{ marginBottom: 'var(--space-5)' }}>
            Opprettet av koordinator — vises i hendelsesfeed og tildeles valgt lag.
          </p>

          {/* Type */}
          <label className="field-label-strong">
            Hendelsestype
          </label>
          <div className="flex flex-wrap gap-2 mb-4">
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
          <label htmlFor="new-oppdrag-team" className="field-label-strong">
            Tildel lag (valgfritt)
          </label>
          <select
            id="new-oppdrag-team"
            value={teamId}
            onChange={(e) => onTeamChange(e.target.value)}
            className="form-input"
            style={{ marginBottom: 'var(--space-4)' }}
          >
            <option value="">— Velg lag —</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}{t.transport ? ` (${t.transport})` : ''}{t.currentPosition ? ' · GPS' : ''}
              </option>
            ))}
          </select>

          {/* Note */}
          <label htmlFor="new-oppdrag-note" className="field-label-strong">
            Sted / beskrivelse
          </label>
          <textarea
            id="new-oppdrag-note"
            value={note}
            onChange={(e) => onNoteChange(e.target.value)}
            placeholder="F.eks. «Sektor B ved inngang, person sitter på bakken»"
            rows={3}
            className="form-textarea"
            style={{ marginBottom: 'var(--space-5)' }}
          />

          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="btn-ghost"
              style={{ flex: 1, minHeight: 'var(--touch-min)' }}
            >
              Avbryt
            </button>
            <button
              onClick={onSubmit}
              disabled={creating}
              className="btn-brand"
              style={{ flex: 2, minHeight: 'var(--touch-min)' }}
            >
              {creating ? 'Oppretter...' : 'Opprett og tildel'}
            </button>
          </div>
        </div>
      </FocusTrap>
    </div>
  );
}
