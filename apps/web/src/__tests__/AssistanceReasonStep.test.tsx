import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import {
  AssistanceReasonStep,
  ASSISTANCE_REASONS,
  encodeAssistanceNote,
  describeAssistanceNote,
} from '../pages/FirstAider/AssistanceReasonStep';

describe('AssistanceReasonStep', () => {
  it('shows all four reason chips', () => {
    render(<AssistanceReasonStep onSend={vi.fn()} onBack={vi.fn()} />);
    for (const reason of ASSISTANCE_REASONS) {
      expect(screen.getByTestId(`firstaid-assist-reason-${reason.id}`)).toBeInTheDocument();
    }
  });

  it('disables "Send" until a reason is picked', () => {
    render(<AssistanceReasonStep onSend={vi.fn()} onBack={vi.fn()} />);
    expect(screen.getByTestId('firstaid-assist-reason-send')).toBeDisabled();
    fireEvent.click(screen.getByTestId('firstaid-assist-reason-transport'));
    expect(screen.getByTestId('firstaid-assist-reason-send')).toBeEnabled();
  });

  it('sends the encoded reason (+ free text) on "Send"', () => {
    const onSend = vi.fn();
    render(<AssistanceReasonStep onSend={onSend} onBack={vi.fn()} />);
    fireEvent.click(screen.getByTestId('firstaid-assist-reason-transport'));
    fireEvent.change(screen.getByPlaceholderText('f.eks. båre til km 12'), { target: { value: 'båre til km 12' } });
    fireEvent.click(screen.getByTestId('firstaid-assist-reason-send'));
    expect(onSend).toHaveBeenCalledWith('transport: båre til km 12');
  });

  it('sends undefined on "Send uten detaljer" regardless of any picked reason', () => {
    const onSend = vi.fn();
    render(<AssistanceReasonStep onSend={onSend} onBack={vi.fn()} />);
    fireEvent.click(screen.getByTestId('firstaid-assist-reason-more_hands'));
    fireEvent.click(screen.getByTestId('firstaid-assist-reason-skip'));
    expect(onSend).toHaveBeenCalledWith(undefined);
  });

  it('calls onBack without sending', () => {
    const onSend = vi.fn();
    const onBack = vi.fn();
    render(<AssistanceReasonStep onSend={onSend} onBack={onBack} />);
    fireEvent.click(screen.getByRole('button', { name: 'Tilbake' }));
    expect(onBack).toHaveBeenCalled();
    expect(onSend).not.toHaveBeenCalled();
  });
});

describe('encodeAssistanceNote / describeAssistanceNote', () => {
  it('encodes a reason with no free text as just the id', () => {
    expect(encodeAssistanceNote('more_hands', '')).toBe('more_hands');
    expect(encodeAssistanceNote('more_hands', '   ')).toBe('more_hands');
  });

  it('encodes a reason with free text as "id: text"', () => {
    expect(encodeAssistanceNote('transport', 'båre til km 12')).toBe('transport: båre til km 12');
  });

  it('round-trips a known reason back to its Norwegian label', () => {
    expect(describeAssistanceNote('more_hands')).toBe('Flere hender');
    expect(describeAssistanceNote('amk_notified')).toBe('AMK er varslet');
    expect(describeAssistanceNote('transport: båre til km 12')).toBe('Transport — båre til km 12');
  });

  it('shows an unrecognised note as-is instead of hiding it', () => {
    expect(describeAssistanceNote('Bevisstløs person ved løypebok')).toBe('Bevisstløs person ved løypebok');
  });

  it('returns null for empty input', () => {
    expect(describeAssistanceNote(null)).toBeNull();
    expect(describeAssistanceNote(undefined)).toBeNull();
    expect(describeAssistanceNote('')).toBeNull();
  });
});
