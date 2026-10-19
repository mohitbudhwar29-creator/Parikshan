// Pure helpers for the browser's speech APIs. No React here, so they can be unit tested.
import type { Locale } from "@/lib/i18n";

/** A spoken question stops after this long, so a forgotten microphone cannot record indefinitely. */
export const MAX_RECORDING_MS = 30_000;

/** Language tag for speech recognition (what the user says). */
export function recognitionLanguage(locale: Locale): string {
  return locale === "hi" ? "hi-IN" : "en-IN";
}

/** Language tag for speech synthesis (how the answer sounds). */
export function speechLanguage(locale: Locale): string {
  return locale === "hi" ? "hi-IN" : "en-IN";
}

export interface VoiceLike {
  name: string;
  lang: string;
}

/**
 * Chooses a synthesis voice for a locale. English prefers Indian English, then British, then US.
 * Hindi only accepts a Hindi voice: reading Devanagari with an English voice produces unintelligible speech,
 * so the caller reports "no Hindi voice" instead.
 */
export function pickVoice<T extends VoiceLike>(voices: readonly T[], locale: Locale): T | null {
  const normalise = (lang: string) => lang.replace("_", "-").toLowerCase();
  if (locale === "hi") {
    return voices.find((voice) => normalise(voice.lang) === "hi-in") ?? voices.find((voice) => normalise(voice.lang).startsWith("hi")) ?? null;
  }
  const preferred = ["en-in", "en-gb", "en-us"];
  for (const tag of preferred) {
    const match = voices.find((voice) => normalise(voice.lang) === tag);
    if (match) return match;
  }
  return voices.find((voice) => normalise(voice.lang).startsWith("en")) ?? null;
}

/** The first audio container the browser can record, in order of preference. */
export function pickRecorderMime(isSupported: (type: string) => boolean): string | null {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
  return candidates.find((type) => isSupported(type)) ?? null;
}

export interface RecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onstart: (() => void) | null;
  onresult: ((event: RecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

export interface RecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
}

export type RecognitionConstructor = new () => RecognitionLike;

/** Returns the browser's speech recognition constructor, or null when the browser has none (e.g. Firefox). */
export function getRecognitionConstructor(): RecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function canRecordAudio(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.mediaDevices?.getUserMedia === "function" && typeof MediaRecorder !== "undefined";
}

export function browserSpeechInputSupported(): boolean {
  return getRecognitionConstructor() !== null;
}

export function browserSpeechOutputSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";
}
