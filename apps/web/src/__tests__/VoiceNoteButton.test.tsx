import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { VoiceNoteButton } from '../pages/FirstAider/VoiceNoteButton';

/** A minimal mock matching just the surface VoiceNoteButton uses. */
class MockSpeechRecognition {
  lang = '';
  continuous = false;
  interimResults = false;
  onresult: ((event: any) => void) | null = null;
  onerror: ((event: any) => void) | null = null;
  onend: (() => void) | null = null;
  start = vi.fn();
  stop = vi.fn(() => { this.onend?.(); });
}

let lastInstance: MockSpeechRecognition | null = null;

function installMockRecognition() {
  lastInstance = null;
  (window as any).SpeechRecognition = vi.fn().mockImplementation(() => {
    lastInstance = new MockSpeechRecognition();
    return lastInstance;
  });
}

describe('VoiceNoteButton (item 8.36)', () => {
  afterEach(() => {
    delete (window as any).SpeechRecognition;
    delete (window as any).webkitSpeechRecognition;
    vi.restoreAllMocks();
  });

  it('renders nothing when the browser has no SpeechRecognition', () => {
    render(<VoiceNoteButton onTranscript={vi.fn()} />);
    expect(screen.queryByLabelText('Diktér notat')).not.toBeInTheDocument();
  });

  it('renders the button when SpeechRecognition exists', () => {
    installMockRecognition();
    render(<VoiceNoteButton onTranscript={vi.fn()} />);
    expect(screen.getByLabelText('Diktér notat')).toBeInTheDocument();
  });

  it('also renders when only webkitSpeechRecognition exists', () => {
    (window as any).webkitSpeechRecognition = vi.fn().mockImplementation(() => new MockSpeechRecognition());
    render(<VoiceNoteButton onTranscript={vi.fn()} />);
    expect(screen.getByLabelText('Diktér notat')).toBeInTheDocument();
  });

  it('starts recognition in Norwegian on click and shows the pulsing dot', () => {
    installMockRecognition();
    render(<VoiceNoteButton onTranscript={vi.fn()} testIdSuffix="pat-1" />);
    fireEvent.click(screen.getByTestId('firstaid-voice-note-pat-1'));
    expect(lastInstance?.start).toHaveBeenCalled();
    expect(lastInstance?.lang).toBe('nb-NO');
    expect(screen.getByTestId('firstaid-voice-note-pat-1-dot')).toBeInTheDocument();
  });

  it('appends the final transcript via onTranscript and ignores interim results', () => {
    installMockRecognition();
    const onTranscript = vi.fn();
    render(<VoiceNoteButton onTranscript={onTranscript} />);
    fireEvent.click(screen.getByLabelText('Diktér notat'));
    act(() => {
      lastInstance!.onresult?.({
        resultIndex: 0,
        results: [
          { isFinal: false, 0: { transcript: 'ikke ferdig' } },
          { isFinal: true, 0: { transcript: 'pasienten er stabil' } },
        ],
      });
    });
    expect(onTranscript).toHaveBeenCalledWith('pasienten er stabil');
  });

  it('stops listening on a second click', () => {
    installMockRecognition();
    render(<VoiceNoteButton onTranscript={vi.fn()} testIdSuffix="pat-1" />);
    const button = screen.getByTestId('firstaid-voice-note-pat-1');
    fireEvent.click(button);
    fireEvent.click(button);
    expect(lastInstance?.stop).toHaveBeenCalled();
    expect(screen.queryByTestId('firstaid-voice-note-pat-1-dot')).not.toBeInTheDocument();
  });

  it('shows an error line when recognition fails, and stops listening', () => {
    installMockRecognition();
    render(<VoiceNoteButton onTranscript={vi.fn()} testIdSuffix="pat-1" />);
    fireEvent.click(screen.getByTestId('firstaid-voice-note-pat-1'));
    act(() => { lastInstance!.onerror?.({ error: 'no-speech' }); });
    expect(screen.getByRole('alert')).toHaveTextContent('no-speech');
    expect(screen.queryByTestId('firstaid-voice-note-pat-1-dot')).not.toBeInTheDocument();
  });
});
