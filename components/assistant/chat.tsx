"use client";

import * as React from "react";
import { Bot, Keyboard, Mic, MicOff, RefreshCw, RotateCcw, Send, ShieldCheck, Square, User, Volume2, VolumeX } from "lucide-react";
import type { MessageKey } from "@/lib/i18n/en";
import type { Locale } from "@/lib/i18n";
import type { VoiceAnswer } from "@/lib/voice/types";
import type { VoiceErrorCode } from "@/lib/voice/client-state";
import type { SpeechMode } from "@/lib/voice/config";
import { browserSpeechInputSupported, browserSpeechOutputSupported, canRecordAudio } from "@/lib/voice/browser-speech";
import { usePrefs } from "@/components/prefs/prefs-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Textarea, Label } from "@/components/ui/form";
import { useVoiceInput } from "@/components/voice/use-voice-input";
import { useVoiceOutput } from "@/components/voice/use-voice-output";
import { VoiceConsent, VOICE_CONSENT_KEY } from "@/components/voice/voice-consent";
import { AnswerDetails } from "@/components/assistant/answer-details";
import { cn } from "@/lib/utils";

interface ChatMessage {
  id: number;
  role: "user" | "assistant";
  text: string;
  answer?: VoiceAnswer;
  via?: "voice" | "text";
}

const SUGGESTIONS: MessageKey[] = [
  "assistant.question1",
  "assistant.question2",
  "assistant.question3",
  "assistant.question5",
  "assistant.question6",
  "assistant.question9",
];

const REQUEST_TIMEOUT_MS = 25_000;
const HISTORY_TURNS = 2;

const VOICE_ERROR_KEYS: Record<Exclude<VoiceErrorCode, "paused" | "rateLimit">, MessageKey> = {
  permission: "voice.error.permission",
  unsupported: "voice.error.unsupported",
  noMicrophone: "voice.error.noMicrophone",
  noSpeech: "voice.error.noSpeech",
  empty: "voice.error.empty",
  network: "voice.error.network",
  provider: "voice.error.provider",
  timeout: "voice.error.timeout",
  tooLong: "voice.error.tooLong",
  unsupportedAudio: "voice.errorUnsupportedAudio",
};

interface ErrorState {
  key: string;
  seconds?: number | null;
}

type AskResult = { ok: true; data: VoiceAnswer } | { ok: false; errorKey: string; retryAfterSeconds?: number | null };

/** Sends a question to the server. The server decides the profile, checks ownership and applies the limits. */
async function requestAnswer(question: string, locale: Locale, history: string[]): Promise<AskResult> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch("/api/voice/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ question, locale, history: history.map((text) => ({ question: text })) }),
      signal: controller.signal,
    });
    const body = (await response.json().catch(() => null)) as { ok?: boolean; data?: VoiceAnswer; errorKey?: string; retryAfterSeconds?: number } | null;
    if (!response.ok || !body?.ok || !body.data) {
      return { ok: false, errorKey: body?.errorKey ?? "voice.errorAnswer", retryAfterSeconds: body?.retryAfterSeconds ?? null };
    }
    return { ok: true, data: body.data };
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    return { ok: false, errorKey: aborted ? "voice.error.timeout" : "voice.error.network" };
  } finally {
    window.clearTimeout(timer);
  }
}

/**
 * Grounded Q&A over the active profile's saved records. Typed and spoken questions take the same path.
 * Voice is an addition to the text chat: the text box is always available.
 */
export function AssistantChat({ hasRecords, sttMode, ttsMode }: { hasRecords: boolean; sttMode: SpeechMode; ttsMode: SpeechMode }) {
  const { t, prefs } = usePrefs();
  const locale = prefs.lang;
  const [messages, setMessages] = React.useState<ChatMessage[]>(() => [{ id: 0, role: "assistant", text: t("assistant.welcome") }]);
  const [input, setInput] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<ErrorState | null>(null);
  const [inputMode, setInputMode] = React.useState<"voice" | "text">("voice");
  const [voiceSupported, setVoiceSupported] = React.useState(false);
  const [outputSupported, setOutputSupported] = React.useState(false);
  const [consented, setConsented] = React.useState(false);
  const [consentOpen, setConsentOpen] = React.useState(false);
  const [played, setPlayed] = React.useState<number[]>([]);
  const nextId = React.useRef(1);
  const messagesRef = React.useRef(messages);
  messagesRef.current = messages;
  const pendingRef = React.useRef(false);
  const listRef = React.useRef<HTMLDivElement>(null);
  const askRef = React.useRef<(question: string, via: "voice" | "text") => Promise<void>>(async () => {});
  const settleRef = React.useRef<() => void>(() => {});

  React.useEffect(() => {
    setVoiceSupported(sttMode === "browser" ? browserSpeechInputSupported() : sttMode === "server" ? canRecordAudio() : false);
    setOutputSupported(ttsMode === "server" || (ttsMode === "browser" && browserSpeechOutputSupported()));
    setConsented(window.localStorage.getItem(VOICE_CONSENT_KEY) === "1");
  }, [sttMode, ttsMode]);

  React.useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, pending]);

  const voice = useVoiceInput({
    mode: sttMode === "server" ? "server" : "browser",
    locale,
    onFinal: (text) => void askRef.current(text, "voice"),
    onDraft: (text) => setInput(text),
  });
  settleRef.current = voice.settle;

  const output = useVoiceOutput({ mode: ttsMode, locale });

  const ask = React.useCallback(
    async (question: string, via: "voice" | "text") => {
      const trimmed = question.trim();
      if (!trimmed || pendingRef.current) return;
      const history = messagesRef.current
        .filter((message) => message.role === "user")
        .slice(-HISTORY_TURNS)
        .map((message) => message.text);
      pendingRef.current = true;
      setError(null);
      setInput("");
      setMessages((current) => [...current, { id: nextId.current++, role: "user", text: trimmed, via }]);
      setPending(true);
      const result = await requestAnswer(trimmed, locale, history);
      pendingRef.current = false;
      setPending(false);
      settleRef.current();
      if (!result.ok) {
        setError({ key: result.errorKey, seconds: result.retryAfterSeconds });
        // Keep the question in the text box when the failure was a connection problem, so it can be sent again.
        if (result.errorKey === "voice.error.network" || result.errorKey === "voice.error.timeout") setInput(trimmed);
        return;
      }
      setMessages((current) => [
        ...current,
        { id: nextId.current++, role: "assistant", text: result.data.answer, answer: result.data, via },
      ]);
    },
    [locale],
  );
  askRef.current = ask;

  function errorText(key: string, seconds?: number | null): string {
    if (key === "voice.errorRateLimit") return t("voice.errorRateLimit", { seconds: seconds ?? 60 });
    if (key === "voice.error.unsupported" && locale === "hi") return t("voice.unsupportedLanguage");
    return t(key as MessageKey);
  }

  function voiceErrorMessage(code: VoiceErrorCode): string {
    if (code === "paused") return t("voice.status.paused");
    if (code === "rateLimit") return t("voice.errorRateLimit", { seconds: voice.retryAfterSeconds ?? 60 });
    if (code === "unsupported" && locale === "hi") return t("voice.unsupportedLanguage");
    return t(VOICE_ERROR_KEYS[code]);
  }

  function startVoice() {
    if (!consented) {
      setConsentOpen(true);
      return;
    }
    voice.start();
  }

  function statusLine(): React.ReactNode {
    if (inputMode !== "voice" || !voiceSupported) return null;
    const { phase, error: voiceError, liveTranscript } = voice.state;
    let message: string;
    if (voiceError) message = voiceErrorMessage(voiceError);
    else if (voice.notice) message = t(voice.notice as MessageKey);
    else if (phase === "requesting") message = t("voice.status.requesting");
    else if (phase === "listening") message = t(sttMode === "server" ? "voice.status.recording" : "voice.status.listening");
    else if (phase === "processing") message = t("voice.status.processing");
    else if (output.speakingId !== null) message = t("voice.status.speaking");
    else message = t("voice.status.idle");
    return (
      <div className="space-y-1 text-sm">
        <p className={cn(voiceError && voiceError !== "paused" ? "font-semibold text-destructive" : "text-muted-foreground")}>{message}</p>
        {liveTranscript && (phase === "listening" || phase === "processing") ? (
          <p className="rounded-lg bg-muted/50 px-3 py-2">
            <span className="font-semibold">{t("voice.live")}: </span>
            {liveTranscript}
          </p>
        ) : null}
      </div>
    );
  }

  const micBusy = voice.state.phase === "requesting" || voice.state.phase === "processing" || pending;
  const listening = voice.state.phase === "listening";
  const speaking = output.speakingId !== null;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
      <Card className="flex min-h-[460px] flex-col">
        <CardContent className="flex flex-1 flex-col gap-4 p-0">
          <div ref={listRef} className="flex max-h-[62vh] min-h-[360px] flex-1 flex-col gap-4 overflow-y-auto p-5" aria-live="polite" aria-relevant="additions">
            {messages.map((message) => (
              <div key={message.id} className={cn("flex gap-3", message.role === "user" && "flex-row-reverse")}>
                <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-full", message.role === "user" ? "bg-secondary text-secondary-foreground" : "bg-primary text-primary-foreground")}>
                  {message.role === "user" ? <User className="size-4" aria-hidden /> : <Bot className="size-4" aria-hidden />}
                </span>
                <div className={cn("max-w-[85%] space-y-2 rounded-2xl px-4 py-3 text-base leading-relaxed", message.role === "user" ? "bg-secondary text-secondary-foreground" : "border border-border bg-muted/50")}>
                  <p className="text-xs font-semibold text-muted-foreground">
                    {message.role === "user" ? (message.via === "voice" ? t("voice.heard") : t("assistant.you")) : t("assistant.copilot")}
                  </p>
                  {message.answer?.blocked === "emergency" ? (
                    <Alert variant="attention" role="alert" className="text-base">
                      <p className="whitespace-pre-line">{message.text}</p>
                    </Alert>
                  ) : (
                    <p className="whitespace-pre-line">{message.text}</p>
                  )}
                  {message.answer ? <AnswerDetails answer={message.answer} t={t} locale={locale} /> : null}
                  {message.answer && outputSupported ? (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {output.speakingId === message.id ? (
                        <Button variant="outline" size="sm" onClick={() => output.stop()}>
                          <Square aria-hidden /> {t("voice.stopSpeaking")}
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={speaking && output.speakingId !== message.id}
                          onClick={() => {
                            setPlayed((current) => (current.includes(message.id) ? current : [...current, message.id]));
                            void output.speak(message.id, message.answer!.answer, message.answer!.speechToken, t("voice.spokenDisclaimer"));
                          }}
                        >
                          {played.includes(message.id) ? <RefreshCw aria-hidden /> : <Volume2 aria-hidden />}
                          {played.includes(message.id) ? t("voice.replay") : t("voice.listen")}
                        </Button>
                      )}
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
            {pending ? (
              <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
                <Bot className="size-4 animate-pulse" aria-hidden /> {t("assistant.thinking")}
              </p>
            ) : null}
            {error ? <Alert variant="attention" role="alert">{errorText(error.key, error.seconds)}</Alert> : null}
          </div>

          <form
            className="space-y-3 border-t border-border p-4"
            onSubmit={(event) => {
              event.preventDefault();
              void ask(input, "text");
            }}
          >
            <Label htmlFor="assistant-question" className="sr-only">{t("assistant.placeholder")}</Label>
            <Textarea
              id="assistant-question"
              rows={2}
              maxLength={500}
              value={input}
              disabled={!hasRecords || pending}
              placeholder={t("assistant.placeholder")}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void ask(input, "text");
                }
              }}
            />

            {consentOpen ? (
              <VoiceConsent
                sttMode={sttMode}
                onAccept={() => {
                  setConsented(true);
                  setConsentOpen(false);
                  voice.start();
                }}
                onCancel={() => setConsentOpen(false)}
              />
            ) : null}

            {voiceSupported && inputMode === "voice" ? statusLine() : null}
            {output.error ? (
              <p role="status" className="text-sm font-semibold text-destructive">
                {t(output.error as MessageKey)}
              </p>
            ) : null}
            {!voiceSupported && sttMode !== "off" && inputMode === "voice" ? (
              <p className="text-sm text-muted-foreground">{t("voice.error.unsupported")}</p>
            ) : null}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => { output.stop(); voice.cancel(); setMessages([{ id: 0, role: "assistant", text: t("assistant.welcome") }]); }}>
                  <RotateCcw aria-hidden /> {t("assistant.clear")}
                </Button>
                {outputSupported ? (
                  <Button type="button" variant="ghost" size="sm" aria-pressed={output.muted} onClick={() => output.setMuted(!output.muted)}>
                    {output.muted ? <VolumeX aria-hidden /> : <Volume2 aria-hidden />}
                    {output.muted ? t("voice.unmute") : t("voice.mute")}
                  </Button>
                ) : null}
                {speaking && voiceSupported ? (
                  <Button type="button" variant="outline" size="sm" onClick={() => { output.stop(); voice.start(); }}>
                    <Mic aria-hidden /> {t("voice.interrupt")}
                  </Button>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {voiceSupported ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!hasRecords}
                    onClick={() => {
                      if (inputMode === "voice") {
                        voice.cancel();
                        setInputMode("text");
                      } else {
                        setInputMode("voice");
                      }
                    }}
                  >
                    <Keyboard aria-hidden /> {inputMode === "voice" ? t("voice.button.typeInstead") : t("voice.button.useVoice")}
                  </Button>
                ) : null}
                {voiceSupported && inputMode === "voice" ? (
                  <Button
                    type="button"
                    variant={listening ? "default" : "outline"}
                    aria-label={listening ? t("voice.button.stop") : t("voice.button.start")}
                    aria-pressed={listening}
                    disabled={!hasRecords || micBusy}
                    onClick={() => (listening ? voice.stop() : startVoice())}
                  >
                    {listening ? <MicOff aria-hidden /> : <Mic aria-hidden />}
                    {listening ? t("voice.button.stop") : t("voice.button.start")}
                  </Button>
                ) : null}
                {listening ? (
                  <Button type="button" variant="ghost" size="sm" onClick={() => voice.cancel()}>
                    {t("voice.button.cancel")}
                  </Button>
                ) : null}
                <Button type="submit" disabled={!hasRecords || pending || input.trim().length === 0}>
                  <Send aria-hidden /> {t("assistant.send")}
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      <aside className="space-y-4">
        <Card>
          <CardContent className="space-y-3 p-5">
            <p className="font-semibold">{t("assistant.examplesTitle")}</p>
            <div className="flex flex-col gap-2">
              {SUGGESTIONS.map((key) => (
                <button
                  key={key}
                  type="button"
                  disabled={!hasRecords || pending}
                  onClick={() => void ask(t(key), "text")}
                  className="rounded-xl border border-border bg-card px-3 py-2 text-left text-sm hover:bg-accent disabled:opacity-50"
                >
                  {t(key)}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
        <Alert variant="info">
          <ShieldCheck className="size-5 shrink-0" aria-hidden />
          <span>{t("assistant.askDoctor")}</span>
        </Alert>
        <Alert variant="info">
          <ShieldCheck className="size-5 shrink-0" aria-hidden />
          <span>{t("disclaimer.full")}</span>
        </Alert>
        {!hasRecords ? <Alert variant="warning">{t("assistant.noRecords")}</Alert> : null}
      </aside>
    </div>
  );
}
