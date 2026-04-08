interface SickBayHeaderProps {
  onNewPatient: () => void;
}

export function SickBayHeader({ onNewPatient }: SickBayHeaderProps) {
  return (
    <div className="flex-between mb-4">
      <h1 className="text-xl fw-700">Sykestue</h1>
      <button
        onClick={onNewPatient}
        className="touch-target btn-brand"
        style={{
          minHeight: 'var(--touch-min)', padding: '0 var(--space-5)',
          fontSize: 'var(--text-sm)',
        }}
      >
        + Ny pasient
      </button>
    </div>
  );
}
