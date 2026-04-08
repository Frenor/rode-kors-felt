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
    <div className="panel-sunken">
      <h4 className="heading-sm">Nytt notat</h4>

      <div className="mb-2">
        <label htmlFor={`note-author-${patientId}`} className="text-xs-subtle">
          Forfatter
        </label>
        <input
          id={`note-author-${patientId}`}
          type="text"
          value={form.author}
          placeholder="Navn (valgfritt)"
          onChange={(e) => onChange({ ...form, author: e.target.value })}
          className="form-input-sm"
        />
      </div>

      <div className="mb-2">
        <label htmlFor={`note-text-${patientId}`} className="text-xs-subtle">
          Notat
        </label>
        <textarea
          id={`note-text-${patientId}`}
          value={form.text}
          placeholder="Skriv notat her..."
          rows={3}
          onChange={(e) => onChange({ ...form, text: e.target.value })}
          className="form-textarea"
          style={{ fontSize: 'var(--text-xs)' }}
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
