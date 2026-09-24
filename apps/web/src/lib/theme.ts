/**
 * Theme persistence.
 *
 * Field teams switch to dark mode at dusk and expect it to stay that way. The
 * PWA is killed and restarted often on a phone, so the choice lives in
 * localStorage and is applied before React renders (see main.tsx) to avoid a
 * white flash in the dark.
 */

export type ThemeChoice = 'auto' | 'light' | 'dark';

export const THEME_STORAGE_KEY = 'rkf-theme';

export const THEME_LABELS: Record<ThemeChoice, string> = {
  auto: 'Auto',
  light: 'Lys',
  dark: 'Mørk',
};

const THEME_CYCLE: Record<ThemeChoice, ThemeChoice> = {
  auto: 'dark',
  dark: 'light',
  light: 'auto',
};

export function nextTheme(current: ThemeChoice): ThemeChoice {
  return THEME_CYCLE[current];
}

export function readStoredTheme(): ThemeChoice {
  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
    return raw === 'light' || raw === 'dark' ? raw : 'auto';
  } catch {
    return 'auto';
  }
}

export function persistTheme(theme: ThemeChoice): void {
  try {
    if (theme === 'auto') window.localStorage.removeItem(THEME_STORAGE_KEY);
    else window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Storage may be blocked (private mode) — the in-memory choice still applies.
  }
}

export function applyTheme(theme: ThemeChoice): void {
  if (typeof document === 'undefined') return;
  if (theme === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', theme);
}
