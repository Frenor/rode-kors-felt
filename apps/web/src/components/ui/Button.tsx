/**
 * Button — the one way to make a control in RKF.
 *
 * Variants encode meaning, not decoration:
 *   primary      the single most important action in its container (brand red)
 *   danger       calls for help / irreversible (critical red, filled)
 *   danger-soft  same meaning, lower weight (critical text on tinted ground)
 *   secondary    everything else that saves or opens (neutral, bordered)
 *   outline      brand-coloured secondary for "go" actions next to a primary
 *   ghost        dismiss / cancel / tertiary
 *   tone         a chip that carries its own colour via --tone / --tone-bg
 *
 * Sizes follow the glove scale (lg 56, md 48, sm 44, xl 72). The minimum
 * cannot be undercut by callers because sizing lives in CSS, not inline.
 */
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'danger-soft' | 'outline' | 'ghost' | 'tone';
export type ButtonSize = 'xl' | 'lg' | 'md' | 'sm';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Stretch to the container width. */
  block?: boolean;
  /** Fully rounded (pills, toggles). */
  pill?: boolean;
  /** Leading icon. */
  icon?: IconName;
  /** Trailing icon. */
  iconEnd?: IconName;
  /** Square icon-only button; pass `aria-label`. */
  iconOnly?: boolean;
  /** Visual selected state for toggle chips (also set aria-pressed / aria-checked). */
  selected?: boolean;
  /** For `variant="tone"`: text/border colour and selected background. */
  tone?: { color: string; bg: string };
  children?: ReactNode;
}

export function Button({
  variant = 'secondary',
  size = 'md',
  block = false,
  pill = false,
  icon,
  iconEnd,
  iconOnly = false,
  selected = false,
  tone,
  className,
  style,
  type = 'button',
  children,
  ...rest
}: ButtonProps) {
  const classes = [
    'btn',
    `btn--${variant}`,
    size !== 'md' ? `btn--${size}` : '',
    block ? 'btn--block' : '',
    pill ? 'btn--pill' : '',
    iconOnly ? 'btn--icon' : '',
    selected ? 'btn--selected' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const toneStyle = tone
    ? ({ '--tone': tone.color, '--tone-bg': tone.bg } as Record<string, string>)
    : undefined;

  return (
    <button type={type} className={classes} style={{ ...toneStyle, ...style }} {...rest}>
      {icon && <Icon name={icon} />}
      {children}
      {iconEnd && <Icon name={iconEnd} />}
    </button>
  );
}
