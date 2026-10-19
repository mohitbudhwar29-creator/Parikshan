"use client";

import * as React from "react";
import type { Locale } from "@/lib/i18n";
import { pickVoice, speechLanguage, browserSpeechOutputSupported } from "@/lib/voice/browser-speech";
import type { SpeechMode } from "@/lib/voice/config";

// Spoken answers only start when the user presses a button. Nothing is read aloud automatically.
// Server mode fetches MP3 audio for the answer text (with a server-issued token) and plays it.
// Browser mode uses speechSynthesis and only speaks when a voice for the language exists.

const MUTE_KEY = "phc_voice_muted";
const VOICE_WAIT_MS = 1500;

export interface VoiceOutput {
  speakingId: number | null;
  muted: boolean;
  setMuted: (muted: boolean) => void;
  /** Translation key of the last output problem, or null. */
  error: string | null;
  speak: (id: number, text: string, speechToken: string | undefined, disclaimer: string) => Promise<void>;
  stop: () => void;
}

function loadVoices(synth: SpeechSynthesis): Promise<SpeechSynthesisVoice[]> {
  const current = synth.getVoices();
  if (current.length > 0) return Promise.resolve(current);
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => resolve(synth.getVoices()), VOICE_WAIT_MS);
    synth.addEventListener(
      "voiceschanged",
      () => {
        window.clearTimeout(timer);
        resolve(synth.getVoices());
      },
      { once: true },
    );
  });
}

export function useVoiceOutput(options: { mode: SpeechMode; locale: Locale }): VoiceOutput {
  const { mode, locale } = options;
  const [speakingId, setSpeakingId] = React.useState<number | null>(null);
  const [muted, setMutedState] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const urlRef = React.useRef<string | null>(null);
  const abortRef = React.useRef<AbortController | null>(null);
  const mutedRef = React.useRef(false);

  React.useEffect(() => {
    const saved = window.localStorage.getItem(MUTE_KEY) === "1";
    mutedRef.current = saved;
    setMutedState(saved);
  }, []);

  const stop = React.useCallback(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    abortRef.current?.abort();
    abortRef.current = null;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
    setSpeakingId(null);
  }, []);

  const setMuted = React.useCallback(
    (value: boolean) => {
      mutedRef.current = value;
      setMutedState(value);
      window.localStorage.setItem(MUTE_KEY, value ? "1" : "0");
      if (value) stop();
    },
    [stop],
  );

  React.useEffect(() => stop, [stop]);

  const speak = React.useCallback(
    async (id: number, text: string, speechToken: string | undefined, disclaimer: string) => {
      stop();
      setError(null);
      if (mutedRef.current) {
        setError("voice.muted");
        return;
      }
      if (mode === "off") return;

      if (mode === "server") {
        if (!speechToken) {
          setError("voice.errorInvalid");
          return;
        }
        const controller = new AbortController();
        abortRef.current = controller;
        setSpeakingId(id);
        try {
          const response = await fetch("/api/voice/speak", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text, locale, token: speechToken }),
            credentials: "same-origin",
            signal: controller.signal,
          });
          if (!response.ok) {
            const body = (await response.json().catch(() => null)) as { errorKey?: string } | null;
            setSpeakingId(null);
            setError(body?.errorKey ?? "voice.errorProvider");
            return;
          }
          const blob = await response.blob();
          if (controller.signal.aborted) return;
          const url = URL.createObjectURL(blob);
          urlRef.current = url;
          const audio = new Audio(url);
          audioRef.current = audio;
          audio.onended = () => stop();
          audio.onerror = () => {
            setError("voice.errorProvider");
            stop();
          };
          await audio.play();
        } catch (failure) {
          if (controller.signal.aborted) return;
          setSpeakingId(null);
          setError(failure instanceof DOMException && failure.name === "NotAllowedError" ? "voice.error.permission" : "voice.error.network");
        }
        return;
      }

      // Browser speech synthesis.
      if (!browserSpeechOutputSupported()) {
        setError("a11y.readAloudUnsupported");
        return;
      }
      const synth = window.speechSynthesis;
      const voices = await loadVoices(synth);
      const voice = pickVoice(voices, locale);
      if (locale === "hi" && !voice) {
        setError("voice.hindiVoiceMissing");
        return;
      }
      const utterance = new SpeechSynthesisUtterance(`${text} ${disclaimer}`);
      utterance.lang = speechLanguage(locale);
      if (voice) utterance.voice = voice;
      utterance.rate = 0.95;
      utterance.onend = () => setSpeakingId((current) => (current === id ? null : current));
      utterance.onerror = (event) => {
        setSpeakingId((current) => (current === id ? null : current));
        if (event.error !== "interrupted" && event.error !== "canceled") setError("voice.error.provider");
      };
      setSpeakingId(id);
      synth.speak(utterance);
    },
    [locale, mode, stop],
  );

  return { speakingId, muted, setMuted, error, speak, stop };
}
