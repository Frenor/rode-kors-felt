/**
 * Pill — a small state marker (triage colour, patient status, engagement).
 *
 * Reads as a label, so it is set in the sans face; the mono face is reserved
 * for data (numbers, times, codes). Colour comes from tokens via `tone`.
 */
import type { HTMLAttributes, ReactNode } from 'react';

export interface PillProps extends HTMLAttributes<HTMLSpanElement> {
  /** Text/border colour and background, normally from a *_STYLE map in lib/constants. */
  tone?: { color: string; bg: string; border?: string };
  /** Leading dot in the pill's colour (for statuses). */
  dot?: boolean;
  size?: 'md' | 'lg';
  children: ReactNode;
}

export function Pill({ tone, dot = false, size = 'md', className, style, children, ...rest }: PillProps) {
  const toneStyle = tone
    ? ({
        '--pill-fg': tone.color,
        '--pill-bg': tone.bg,
        '--pill-border': tone.border ?? 'transparent',
      } as Record<string, string>)
    : undefined;
  const classes = ['pill', size === 'lg' ? 'pill--lg' : '', className].filter(Boolean).join(' ');
  return (
    <span className={classes} style={{ ...toneStyle, ...style }} {...rest}>
      {dot && <span className="pill__dot" aria-hidden="true" />}
      {children}
    </span>
  );
}
