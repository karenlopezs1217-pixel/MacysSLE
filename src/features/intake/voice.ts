/** Minimal typings for the (non-standard, vendor-prefixed) Web Speech API. */
interface SpeechRecognitionResultLike {
  0: { transcript: string };
  isFinal: boolean;
}
export interface SpeechRecognitionEventLike {
  results: ArrayLike<SpeechRecognitionResultLike>;
}
export interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

/** The browser's recognizer, or null when voice input is unavailable (e.g. Firefox). */
export function getSpeechRecognition(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function describeVoiceError(code: string | undefined): string {
  switch (code) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'Microphone access was blocked.';
    case 'no-speech':
      return "I didn't hear anything.";
    case 'audio-capture':
      return 'No microphone was found.';
    case 'network':
      return "The browser's speech service is unreachable.";
    default:
      return 'Voice input stopped unexpectedly.';
  }
}
