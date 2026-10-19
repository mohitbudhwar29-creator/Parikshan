"use client";

import * as React from "react";
import { INITIAL_VOICE_STATE, mapRecognitionError, mapVoiceApiError, voiceReducer, type VoiceErrorCode, type VoiceState } from "@/lib/voice/client-state";
import {
  canRecordAudio,
  getRecognitionConstructor,
  MAX_RECORDING_MS,
  pickRecorderMime,
  recognitionLanguage,
  type RecognitionLike,
} from "@/lib/voice/browser-speech";
import { MIN_AUDIO_BYTES } from "@/lib/voice/audio";
import type { Locale } from "@/lib/i18n";

// Microphone access happens only when start() is called from a click. Nothing listens in the background.
// Browser mode uses the Web Speech API (live transcript). Server mode records a short clip and sends it to
// /api/voice/transcribe; the clip is held in memory, uploaded once, and discarded.

const UPLOAD_TIMEOUT_MS = 30_000;

export interface VoiceInputOptions {
  mode: "browser" | "server";
  locale: Locale;
  /** Called with a finished, non-empty transcript. The chat sends it as a question. */
  onFinal: (text: string) => void;
  /** Called with partial text when the attempt fails, so the user can keep it in the text box. */
  onDraft: (text: string) => void;
}

export interface VoiceInput {
  state: VoiceState;
  notice: string | null;
  retryAfterSeconds: number | null;
  start: () => void;
  stop: () => void;
  cancel: () => void;
  /** Call once the question has been answered, to return the control to idle. */
  settle: () => void;
}

export function useVoiceInput(options: VoiceInputOptions): VoiceInput {
  const [state, dispatch] = React.useReducer(voiceReducer, INITIAL_VOICE_STATE);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [retryAfterSeconds, setRetryAfterSeconds] = React.useState<number | null>(null);
  const optionsRef = React.useRef(options);
  optionsRef.current = options;

  const busyRef = React.useRef(false);
  const sessionRef = React.useRef(0);
  const recognitionRef = React.useRef<RecognitionLike | null>(null);
  const recorderRef = React.useRef<MediaRecorder | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const chunksRef = React.useRef<Blob[]>([]);
  const timerRef = React.useRef<number | null>(null);
  const uploadRef = React.useRef<AbortController | null>(null);
  const liveRef = React.useRef("");

  const releaseMic = React.useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    recorderRef.current = null;
    recognitionRef.current = null;
    chunksRef.current = [];
    busyRef.current = false;
  }, []);

  const fail = React.useCallback((error: VoiceErrorCode, retry: number | null = null) => {
    busyRef.current = false;
    setRetryAfterSeconds(retry);
    dispatch({ type: "FAIL", error });
  }, []);

  const finish = React.useCallback((text: string) => {
    const trimmed = text.trim();
    busyRef.current = false;
    if (!trimmed) {
      dispatch({ type: "FINAL", text: "" });
      return;
    }
    dispatch({ type: "FINAL", text: trimmed });
    optionsRef.current.onFinal(trimmed);
  }, []);

  const cancel = React.useCallback(() => {
    sessionRef.current += 1;
    try {
      recognitionRef.current?.abort();
    } catch {
      // Already stopped.
    }
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.onstop = null; // discard the clip: nothing is uploaded
      recorder.stop();
    }
    uploadRef.current?.abort();
    uploadRef.current = null;
    releaseMic();
    dispatch({ type: "DONE" });
  }, [releaseMic]);

  const startBrowser = React.useCallback(
    (session: number) => {
      const Recognition = getRecognitionConstructor();
      if (!Recognition) return fail("unsupported");
      const recognition = new Recognition();
      recognitionRef.current = recognition;
      recognition.lang = recognitionLanguage(optionsRef.current.locale);
      recognition.continuous = false;
      recognition.interimResults = true;
      let finalText = "";
      let errorCode: VoiceErrorCode | null = null;
      liveRef.current = "";

      recognition.onstart = () => {
        if (session === sessionRef.current) dispatch({ type: "LISTENING" });
      };
      recognition.onresult = (event) => {
        if (session !== sessionRef.current) return;
        let interim = "";
        for (let index = event.resultIndex; index < event.results.length; index += 1) {
          const result = event.results[index];
          const piece = result?.[0]?.transcript ?? "";
          if (result?.isFinal) finalText += piece;
          else interim += piece;
        }
        liveRef.current = `${finalText}${interim}`.trim();
        dispatch({ type: "LIVE", text: liveRef.current });
      };
      recognition.onerror = (event) => {
        if (session !== sessionRef.current) return;
        errorCode = mapRecognitionError(event.error);
      };
      recognition.onend = () => {
        if (session !== sessionRef.current) return;
        const text = liveRef.current;
        releaseMic();
        if (errorCode) {
          if (text) optionsRef.current.onDraft(text);
          fail(errorCode);
          return;
        }
        finish(text);
      };
      try {
        recognition.start();
      } catch {
        releaseMic();
        fail("provider");
      }
    },
    [fail, finish, releaseMic],
  );

  const uploadClip = React.useCallback(
    async (session: number, mime: string) => {
      const blob = new Blob(chunksRef.current, { type: mime });
      releaseMic();
      if (session !== sessionRef.current) return;
      if (blob.size < MIN_AUDIO_BYTES) return fail("empty");

      dispatch({ type: "PROCESSING" });
      const controller = new AbortController();
      uploadRef.current = controller;
      const timeout = window.setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);
      try {
        const form = new FormData();
        form.append("audio", blob, "question");
        form.append("locale", optionsRef.current.locale);
        const response = await fetch("/api/voice/transcribe", { method: "POST", body: form, credentials: "same-origin", signal: controller.signal });
        const body = (await response.json().catch(() => null)) as {
          ok?: boolean;
          data?: { transcript: string };
          errorKey?: string;
          retryAfterSeconds?: number;
        } | null;
        if (session !== sessionRef.current) return;
        if (!response.ok || !body?.ok || !body.data) {
          return fail(mapVoiceApiError(body?.errorKey ?? ""), body?.retryAfterSeconds ?? null);
        }
        finish(body.data.transcript);
      } catch (error) {
        if (session !== sessionRef.current) return;
        const aborted = controller.signal.aborted && error instanceof Error && error.name === "AbortError";
        fail(aborted ? "timeout" : "network");
      } finally {
        window.clearTimeout(timeout);
        if (uploadRef.current === controller) uploadRef.current = null;
      }
    },
    [fail, finish, releaseMic],
  );

  const startServer = React.useCallback(
    async (session: number) => {
      if (!canRecordAudio() || typeof MediaRecorder === "undefined") return fail("unsupported");
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (error) {
        if (session !== sessionRef.current) return;
        const name = error instanceof Error ? error.name : "";
        if (name === "NotAllowedError" || name === "SecurityError") return fail("permission");
        if (name === "NotFoundError" || name === "OverconstrainedError") return fail("noMicrophone");
        return fail("provider");
      }
      if (session !== sessionRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      const mime = pickRecorderMime((type) => MediaRecorder.isTypeSupported(type)) ?? "audio/webm";
      const recorder = new MediaRecorder(stream, { mimeType: mime });
      recorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        void uploadClip(session, recorder.mimeType || mime);
      };
      recorder.start(1000);
      dispatch({ type: "LISTENING" });
      timerRef.current = window.setTimeout(() => {
        setNotice("voice.error.tooLong");
        if (recorder.state !== "inactive") recorder.stop();
      }, MAX_RECORDING_MS);
    },
    [fail, uploadClip],
  );

  const start = React.useCallback(() => {
    if (busyRef.current) return;
    sessionRef.current += 1;
    busyRef.current = true;
    setNotice(null);
    setRetryAfterSeconds(null);
    dispatch({ type: "REQUEST" });
    const session = sessionRef.current;
    if (optionsRef.current.mode === "browser") startBrowser(session);
    else void startServer(session);
  }, [startBrowser, startServer]);

  const stop = React.useCallback(() => {
    if (optionsRef.current.mode === "browser") {
      recognitionRef.current?.stop();
      return;
    }
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
  }, []);

  const settle = React.useCallback(() => dispatch({ type: "DONE" }), []);

  // Going to the background ends the attempt: the microphone is released and nothing is sent.
  React.useEffect(() => {
    const onHidden = () => {
      if (!busyRef.current && uploadRef.current === null) return;
      cancel();
      dispatch({ type: "PAUSE" });
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") onHidden();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onHidden);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onHidden);
      cancel();
    };
  }, [cancel]);

  return { state, notice, retryAfterSeconds, start, stop, cancel, settle };
}
