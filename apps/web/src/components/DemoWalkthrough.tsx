import { useState } from 'react';

const STEPS = {
  coordinator: [
    'Se hendelsesfeeden til venstre og kartet til høyre — 3 aktive hendelser',
    'Klikk "⚠ Eskalér" på en hendelse for å eskalere til AMK',
    'Klikk "+ Nytt oppdrag" for å opprette en koordinatorhendelse',
    'Se "Kritiske pasienter"-panelet øverst for NEWS2-varsler',
  ],
  sickbay: [
    'Fire pasienter er innlagt — én er "Innkommende" og trenger registrering',
    'Klikk "+ Vitale tegn" på en pasient for å registrere målinger',
    'Klikk "Logg" for å se pasienthistorikk og medikamenter',
    'Klikk "→ Overføres" for å starte SBAR-overleveringsprosessen',
  ],
  first_aider: [
    'Velg patrulje Alpha fra listen oppe til høyre',
    'Klikk "Meld hendelse" for å rapportere en ny hendelse',
    'Fyll ut skjemaet steg for steg — GPS-posisjon fanges automatisk',
  ],
} as const;

interface DemoWalkthroughProps {
  role: string | null;
}

export function DemoWalkthrough({ role }: DemoWalkthroughProps) {
  const roleKey: keyof typeof STEPS = role && role in STEPS ? (role as keyof typeof STEPS) : 'coordinator';
  const steps = [...(STEPS[roleKey] ?? STEPS.coordinator)];
  const storageKey = `rkf-demo-step-${role ?? 'unknown'}`;
  const [step, setStep] = useState(() => {
    const saved = localStorage.getItem(storageKey);
    return saved ? parseInt(saved, 10) : 0;
  });
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(`rkf-demo-walkthrough-dismissed-${role}`) === '1',
  );

  if (dismissed) return null;

  const goNext = () => {
    const next = Math.min(step + 1, steps.length - 1);
    setStep(next);
    localStorage.setItem(storageKey, String(next));
  };

  const dismiss = () => {
    localStorage.setItem(`rkf-demo-walkthrough-dismissed-${role}`, '1');
    setDismissed(true);
  };

  return (
    <div
      role="complementary"
      aria-label="Demo-veiledning"
      style={{
        position: 'fixed',
        bottom: 'var(--space-6)',
        right: 'var(--space-6)',
        zIndex: 'var(--z-overlay)',
        background: 'var(--color-surface)',
        border: '1px solid var(--color-status-info)',
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--space-4)',
        maxWidth: 280,
        boxShadow: 'var(--shadow-lg)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--color-status-info)', fontWeight: 700 }}>
          DEMO {step + 1}/{steps.length}
        </span>
        <button
          onClick={dismiss}
          aria-label="Lukk veiledning"
          style={{ background: 'transparent', border: 'none', color: 'var(--color-text-subtle)', cursor: 'pointer', fontSize: 'var(--text-sm)' }}
        >
          ✕
        </button>
      </div>
      <p style={{ fontSize: 'var(--text-sm)', marginBottom: 'var(--space-3)', lineHeight: 'var(--leading-relaxed)' }}>
        {steps[step]}
      </p>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {steps.map((_, i: number) => (
            <span
              key={i}
              style={{
                width: 6, height: 6,
                borderRadius: '50%',
                background: i === step ? 'var(--color-status-info)' : 'var(--color-border)',
                display: 'inline-block',
              }}
            />
          ))}
        </div>
        {step < steps.length - 1 ? (
          <button
            onClick={goNext}
            style={{
              background: 'var(--color-status-info)',
              color: 'white',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-1) var(--space-3)',
              fontSize: 'var(--text-xs)',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Neste →
          </button>
        ) : (
          <button
            onClick={dismiss}
            style={{
              background: 'transparent',
              color: 'var(--color-text-subtle)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-1) var(--space-3)',
              fontSize: 'var(--text-xs)',
              cursor: 'pointer',
            }}
          >
            Lukk
          </button>
        )}
      </div>
    </div>
  );
}
