import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { TriageChips } from '../pages/FirstAider/TriageChips';

describe('TriageChips (gap A2)', () => {
  it('renders all four triage colours', () => {
    render(<TriageChips value={null} onChange={vi.fn()} idPrefix="firstaid-triage-pat-1" />);
    expect(screen.getByTestId('firstaid-triage-pat-1-red')).toBeInTheDocument();
    expect(screen.getByTestId('firstaid-triage-pat-1-yellow')).toBeInTheDocument();
    expect(screen.getByTestId('firstaid-triage-pat-1-green')).toBeInTheDocument();
    expect(screen.getByTestId('firstaid-triage-pat-1-black')).toBeInTheDocument();
  });

  it('marks the current value as checked', () => {
    render(<TriageChips value="yellow" onChange={vi.fn()} idPrefix="firstaid-triage-pat-1" />);
    expect(screen.getByTestId('firstaid-triage-pat-1-yellow')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('firstaid-triage-pat-1-red')).toHaveAttribute('aria-checked', 'false');
  });

  it('calls onChange with the picked colour', () => {
    const onChange = vi.fn();
    render(<TriageChips value="yellow" onChange={onChange} idPrefix="firstaid-triage-pat-1" />);
    fireEvent.click(screen.getByTestId('firstaid-triage-pat-1-red'));
    expect(onChange).toHaveBeenCalledWith('red');
  });
});
