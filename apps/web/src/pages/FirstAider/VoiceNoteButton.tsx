/**
 * VoiceNoteButton
 *
 * Dictates into a note field via the Web Speech API (item 8.36). Typing a
 * skadenotat with gloves on, in the rain, is the wrong trade-off when the
 * phone can just listen. Rendered only when the browser actually exposes
 * `SpeechRecognition` — many browsers still don't, so this never claims a
 * capability the device cannot deliver. Hidden entirely otherwise; a
 * recognition error is shown as a small line, never swallowed.
 */
import { useEffect, useRef, useState } from 'react';
import { Button } from '../../components/ui';

// The Web Speech API has no TypeScript DOM lib types — declared narrowly to
// just the surface this component uses.
interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: { transcript: string };
}
interface SpeechRecognitionResultListLike {
  length: number;
  [index: number]: SpeechRecognitionResultLike;
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: SpeechRecognitionResultListLike;
}
interface SpeechRecognitionErrorEventLike {
  error: string;
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export interface VoiceNoteButtonProps {
  /** Appends the final transcript to whatever text is already in the field. */
  onTranscript: (text: string) => void;
  /** Suffix for the button's testid — pass the patient id so several
   *  instances can coexist in tests (only one is ever mounted at once in
   *  the dashboard, since only one patient card is expanded at a time). */
  testIdSuffix?: string;
}

export function VoiceNoteButton({ onTranscript, testIdSuffix }: VoiceNoteButtonProps) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState('');
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    setSupported(getSpeechRecognitionCtor() !== null);
  }, []);

  // Stop any in-flight recognition on unmount (patient card collapsed, or
  // the whole dashboard torn down) — never leave the microphone open.
  useEffect(() => () => {
    recognitionRef.current?.stop();
  }, []);

  if (!supported) return null;

  const testId = testIdSuffix ? `firstaid-voice-note-${testIdSuffix}` : 'firstaid-voice-note';

  const stopListening = () => {
    recognitionRef.current?.stop();
    setListening(false);
  };

  const startListening = () => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) return;
    const recognition = new Ctor();
    recognition.lang = 'nb-NO';
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      let finalText = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result?.isFinal) finalText += result[0].transcript;
      }
      if (finalText.trim()) onTranscript(finalText.trim());
    };
    recognition.onerror = (event) => {
      setError(`Diktering feilet — ${event.error}`);
      setListening(false);
    };
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    setError('');
    recognition.start();
    setListening(true);
  };

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
      <Button
        type="button"
        variant="ghost"
        iconOnly
        icon="mic"
        aria-label="Diktér notat"
        aria-pressed={listening}
        data-testid={testId}
        onClick={listening ? stopListening : startListening}
        style={{ position: 'relative', flexShrink: 0 }}
      >
        {listening && (
          <span
            aria-hidden="true"
            data-testid={`${testId}-dot`}
            style={{
              position: 'absolute',
              top: 4,
              right: 4,
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: 'var(--color-status-critical)',
              animation: 'pulse-critical 1s ease-in-out infinite',
            }}
          />
        )}
      </Button>
      {error && (
        <span role="alert" style={{ fontSize: 'var(--text-xs)', color: 'var(--color-status-critical)' }}>
          {error}
        </span>
      )}
    </div>
  );
}
