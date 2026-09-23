import { Button } from '../../components/ui';

export interface NoteFormShape {
  text: string;
  author: string;
}

interface NotePanelProps {
  patientId: string;
  form: NoteFormShape;
  onChange: (f: NoteFormShape) => void;
  onSubmit: () => void;
}

export function NotePanel({ patientId, form, onChange, onSubmit }: NotePanelProps) {
  return (
    <div style={{
      marginTop: 'var(--space-3)', padding: 'var(--space-3)',
      background: 'var(--color-surface-sunken)', borderRadius: 'var(--radius-md)',
    }}>
      <h4 style={{ fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 'var(--space-2)' }}>Nytt notat</h4>

      <div style={{ marginBottom: 'var(--space-2)' }}>
        <label htmlFor={`note-author-${patientId}`} className="section-label" style={{ display: 'block', marginBottom: 4 }}>
          Forfatter
        </label>
        <input
          id={`note-author-${patientId}`}
          type="text"
          value={form.author}
          placeholder="Navn (valgfritt)"
          onChange={(e) => onChange({ ...form, author: e.target.value })}
          className="field"
        />
      </div>

      <div style={{ marginBottom: 'var(--space-2)' }}>
        <label htmlFor={`note-text-${patientId}`} className="section-label" style={{ display: 'block', marginBottom: 4 }}>
          Notat
        </label>
        <textarea
          id={`note-text-${patientId}`}
          value={form.text}
          placeholder="Skriv notat her..."
          rows={3}
          onChange={(e) => onChange({ ...form, text: e.target.value })}
          className="field"
        />
      </div>

      <Button variant="secondary" block onClick={onSubmit} disabled={!form.text.trim()}>
        Lagre notat
      </Button>
    </div>
  );
}
