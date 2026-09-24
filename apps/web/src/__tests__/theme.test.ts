import { beforeEach, describe, expect, it } from 'vitest';
import { applyTheme, nextTheme, persistTheme, readStoredTheme, THEME_STORAGE_KEY } from '../lib/theme';

describe('theme persistence', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  it('defaults to auto and ignores garbage', () => {
    expect(readStoredTheme()).toBe('auto');
    window.localStorage.setItem(THEME_STORAGE_KEY, 'neon');
    expect(readStoredTheme()).toBe('auto');
  });

  it('remembers dark across restarts and clears on auto', () => {
    persistTheme('dark');
    expect(readStoredTheme()).toBe('dark');
    persistTheme('auto');
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
    expect(readStoredTheme()).toBe('auto');
  });

  it('cycles auto → dark → light → auto', () => {
    expect(nextTheme('auto')).toBe('dark');
    expect(nextTheme('dark')).toBe('light');
    expect(nextTheme('light')).toBe('auto');
  });

  it('applies the attribute the tokens stylesheet keys on', () => {
    applyTheme('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    applyTheme('auto');
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });
});
