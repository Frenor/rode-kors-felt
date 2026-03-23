interface SickBayHeaderProps {
  onNewPatient: () => void;
}

export function SickBayHeader({ onNewPatient }: SickBayHeaderProps) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
      <h1 style={{ fontSize: 'var(--text-xl)', fontWeight: 700 }}>Sykestue</h1>
      <button
        onClick={onNewPatient}
        className="touch-target"
        style={{
          minHeight: 'var(--touch-min)', padding: '0 var(--space-5)', borderRadius: 'var(--radius-md)',
          border: 'none', background: 'var(--color-brand)', color: 'white',
          fontSize: 'var(--text-sm)', fontWeight: 600, cursor: 'pointer',
        }}
      >
        + Ny pasient
      </button>
    </div>
  );
}
