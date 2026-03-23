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
        <label htmlFor={`note-author-${patientId}`} style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-subtle)' }}>
          Forfatter
        </label>
        <input
          id={`note-author-${patientId}`}
          type="text"
          value={form.author}
          placeholder="Navn (valgfritt)"
          onChange={(e) => onChange({ ...form, author: e.target.value })}
          style={{
            width: '100%', height: 36, padding: '0 var(--space-2)',
            borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-input-border)',
            background: 'var(--color-input-bg)', color: 'var(--color-text)', fontSize: 'var(--text-xs)',
          }}
        />
      </div>

      <div style={{ marginBottom: 'var(--space-2)' }}>
        <label htmlFor={`note-text-${patientId}`} style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-subtle)' }}>
          Notat
        </label>
        <textarea
          id={`note-text-${patientId}`}
          value={form.text}
          placeholder="Skriv notat her..."
          rows={3}
          onChange={(e) => onChange({ ...form, text: e.target.value })}
          style={{
            width: '100%', padding: 'var(--space-2)',
            borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-input-border)',
            background: 'var(--color-input-bg)', color: 'var(--color-text)',
            fontSize: 'var(--text-xs)', resize: 'vertical', fontFamily: 'inherit',
          }}
        />
      </div>

      <button
        onClick={onSubmit}
        disabled={!form.text.trim()}
        style={{
          width: '100%', minHeight: 36, borderRadius: 'var(--radius-sm)',
          border: 'none', background: 'var(--color-brand)', color: 'white',
          fontSize: 'var(--text-xs)', fontWeight: 600, cursor: 'pointer',
          opacity: form.text.trim() ? 1 : 0.5,
        }}
      >
        Lagre notat
      </button>
    </div>
  );
}
