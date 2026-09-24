/**
 * LastVitalsLine — the set a patrol just saved stays visible, with its NEWS2.
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LastVitalsLine, News2Pill, summarizeVitals } from '../pages/FirstAider/LastVitalsLine';

const vitals = { pulse: 112, spo2: 93, respiratoryRate: 24, systolicBP: 100, temperature: 37.8, acvpu: 'alert' as const, timestamp: '2026-09-23T10:40:00Z' };

describe('LastVitalsLine', () => {
  it('summarises only recorded values', () => {
    expect(summarizeVitals({ pulse: 80, timestamp: vitals.timestamp })).toBe('Puls 80');
    expect(summarizeVitals(vitals)).toBe('Puls 112 · SpO₂ 93 % · RF 24 · BT 100 · Temp 37.8 · ACVPU A');
  });

  it('shows the last set with its NEWS2 total and level', () => {
    render(<LastVitalsLine patientId="p1" vitals={vitals} />);
    const line = screen.getByTestId('firstaid-last-vitals-p1');
    expect(line).toHaveTextContent('Puls 112 · SpO₂ 93 % · RF 24');
    // RR 24 → 2, SpO₂ 93 → 2, BP 100 → 2, pulse 112 → 2, temp 37.8 → 0 = 8 → høy
    expect(line).toHaveTextContent('NEWS2 8');
    expect(line).toHaveTextContent('høy');
  });

  it('renders a compact pill for a collapsed row', () => {
    render(<News2Pill vitals={{ pulse: 80, timestamp: vitals.timestamp }} />);
    expect(screen.getByLabelText('NEWS2 0, rutine')).toBeInTheDocument();
  });
});
