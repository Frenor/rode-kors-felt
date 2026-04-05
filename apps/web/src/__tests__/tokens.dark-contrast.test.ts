import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function hexToRgb(hex: string): [number, number, number] {
  const normalized = hex.replace('#', '');
  const full = normalized.length === 3
    ? normalized.split('').map((c) => `${c}${c}`).join('')
    : normalized;
  const value = Number.parseInt(full, 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const linear = [r, g, b].map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.03928
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return (0.2126 * linear[0]) + (0.7152 * linear[1]) + (0.0722 * linear[2]);
}

function contrastRatio(foregroundHex: string, backgroundHex: string): number {
  const fg = relativeLuminance(hexToRgb(foregroundHex));
  const bg = relativeLuminance(hexToRgb(backgroundHex));
  const lighter = Math.max(fg, bg);
  const darker = Math.min(fg, bg);
  return (lighter + 0.05) / (darker + 0.05);
}

function extractDarkVars(): Record<string, string> {
  const tokensPath = resolve(__dirname, '../styles/tokens.css');
  const css = readFileSync(tokensPath, 'utf-8');
  const darkBlockMatch = css.match(/\[data-theme='dark']\s*\{([\s\S]*?)\n\}/);
  expect(darkBlockMatch).toBeTruthy();
  const block = darkBlockMatch?.[1] ?? '';

  const vars: Record<string, string> = {};
  const varRegex = /--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\s*;/g;
  let match = varRegex.exec(block);
  while (match) {
    vars[match[1]] = match[2];
    match = varRegex.exec(block);
  }
  return vars;
}

describe('dark mode token contrast (WCAG)', () => {
  const vars = extractDarkVars();

  it('keeps text tokens AA compliant on surface', () => {
    const surface = vars['color-surface'];
    expect(surface).toBeTruthy();

    const checks: Array<[string, number]> = [
      ['color-text', 4.5],
      ['color-text-muted', 4.5],
      ['color-text-subtle', 4.5],
    ];

    for (const [token, threshold] of checks) {
      const ratio = contrastRatio(vars[token]!, surface!);
      expect(ratio, `${token} ratio ${ratio.toFixed(2)} < ${threshold}`).toBeGreaterThanOrEqual(threshold);
    }
  });

  it('keeps clinical status and AVPU tokens at AAA level on surface', () => {
    const surface = vars['color-surface'];
    const clinicalTokens = [
      'color-status-critical',
      'color-status-warning',
      'color-status-ok',
      'color-status-info',
      'color-avpu-alert',
      'color-avpu-confused',
      'color-avpu-voice',
      'color-avpu-pain',
      'color-avpu-unresponsive',
    ];

    for (const token of clinicalTokens) {
      const ratio = contrastRatio(vars[token]!, surface!);
      expect(ratio, `${token} ratio ${ratio.toFixed(2)} < 7.0`).toBeGreaterThanOrEqual(7);
    }
  });

  it('keeps strong/input borders distinguishable in dark mode', () => {
    const surface = vars['color-surface'];
    const inputBg = vars['color-input-bg'];

    const borderStrongRatio = contrastRatio(vars['color-border-strong']!, surface!);
    expect(borderStrongRatio, `color-border-strong ratio ${borderStrongRatio.toFixed(2)} < 3.0`).toBeGreaterThanOrEqual(3);

    const inputBorderRatio = contrastRatio(vars['color-input-border']!, inputBg!);
    expect(inputBorderRatio, `color-input-border ratio ${inputBorderRatio.toFixed(2)} < 3.0`).toBeGreaterThanOrEqual(3);
  });
});
