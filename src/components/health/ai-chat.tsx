"use client";

import * as React from "react";
import Link from "next/link";
import { Loader2, MessageCircleQuestion, Send, Sparkles, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/components/providers/i18n-provider";
import { ReadAloudButton } from "@/components/layout/read-aloud-button";
import { askAssistantAction, clearChatAction } from "@/lib/actions/assistant";
import { formatDate } from "@/lib/i18n/format";
import type { ChatSource } from "@/types/domain";
import { cn } from "@/lib/utils";

const SUGGESTION_KEYS = ["assistant.q1", "assistant.q2", "assistant.q3", "assistant.q4", "assistant.q5", "assistant.q6", "assistant.q7", "assistant.q8"] as const;

export type ChatMessageView = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources: ChatSource[];
  grounded: boolean;
};

/**
 * Conversational assistant.
 *
 * Grounding rules visible in the UI:
 *  • Answers always list the records they came from ("Based on: ...").
 *  • A "not in your records" answer looks deliberately different from a real one.
 *  • The "Ask a doctor" note is always present, and the assistant never gives
 *    instructions about medication changes.
 */
export function AIChat({
  initialMessages,
  providerName,
  isMock,
  recordCount,
}: {
  initialMessages: ChatMessageView[];
  providerName: string;
  isMock: boolean;
  recordCount: number;
}) {
  const { t, lang, easyRead } = useI18n();
  const [messages, setMessages] = React.useState<ChatMessageView[]>(initialMessages);
  const [input, setInput] = React.useState("");
  const [isSending, setIsSending] = React.useState(false);
  const listRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, isSending]);

  const send = async (question: string) => {
    const trimmed = question.trim();
    if (trimmed.length < 2) return;
    setInput("");
    setIsSending(true);

    const optimistic: ChatMessageView = {
      id: `local-${Date.now()}`,
      role: "user",
      content: trimmed,
      sources: [],
      grounded: true,
    };
    setMessages((current) => [...current, optimistic]);

    const result = await askAssistantAction({ question: trimmed });
    setIsSending(false);

    if (!result.ok) {
      setMessages((current) => [
        ...current,
        {
          id: `error-${Date.now()}`,
          role: "assistant",
          content: result.error === "QUESTION_TOO_SHORT" ? t("assistant.messageTooShort") : t("error.aiFailed"),
          sources: [],
          grounded: false,
        },
      ]);
      return;
    }

    setMessages((current) => [
      ...current,
      {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: result.answer,
        sources: result.sources,
        grounded: result.grounded,
      },
    ]);
  };

  const clearChat = async () => {
    await clearChatAction();
    setMessages([]);
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <Card className="flex min-h-[32rem] flex-col overflow-hidden">
        <div
          ref={listRef}
          className="flex-1 space-y-4 overflow-y-auto p-4 scrollbar-thin sm:p-5"
          role="log"
          aria-live="polite"
          aria-label={t("assistant.title")}
        >
          {messages.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
              <span aria-hidden="true" className="flex size-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
                <MessageCircleQuestion className="size-7" />
              </span>
              <h2 className="text-lg font-semibold text-ink-900">{t("assistant.emptyTitle")}</h2>
              <p className="max-w-md text-sm text-muted">{t("assistant.emptyBody")}</p>
              {recordCount === 0 && (
                <Button asChild variant="secondary" className="mt-2">
                  <Link href="/upload">{t("nav.upload")}</Link>
                </Button>
              )}
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={cn("flex flex-col gap-1.5", message.role === "user" ? "items-end" : "items-start")}
            >
              <span className="px-1 text-xs font-semibold uppercase tracking-wide text-ink-400">
                {message.role === "user" ? t("assistant.you") : t("assistant.assistantName")}
              </span>
              <div
                className={cn(
                  "max-w-[95%] whitespace-pre-line rounded-2xl px-4 py-3 text-base leading-relaxed sm:max-w-[85%]",
                  message.role === "user"
                    ? "bg-brand-600 text-white"
                    : message.grounded
                      ? "border border-ink-200 bg-white text-ink-800"
                      : "border border-watch-100 bg-watch-50 text-ink-800",
                )}
              >
                {message.content}
              </div>

              {message.role === "assistant" && (
                <div className="flex flex-wrap items-center gap-2 px-1">
                  {!message.grounded && <Badge variant="watch">{t("assistant.notFound")}</Badge>}
                  {message.sources.map((source) => (
                    <Link
                      key={source.recordId}
                      href={`/records/${source.recordId}`}
                      className="text-xs font-medium text-brand-700 underline underline-offset-4 hover:text-brand-800"
                    >
                      {t("assistant.basedOn")}: {source.title} — {formatDate(source.date, lang)}
                    </Link>
                  ))}
                  <ReadAloudButton text={message.content} size="icon" />
                </div>
              )}
            </div>
          ))}

          {isSending && (
            <div className="flex items-center gap-2 text-brand-700" role="status" aria-live="polite">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              <span className="text-sm font-medium">{t("assistant.thinking")}</span>
            </div>
          )}
        </div>

        <div className="border-t border-ink-200 bg-white p-3 sm:p-4">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void send(input);
            }}
            className="flex items-end gap-2"
          >
            <Textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void send(input);
                }
              }}
              rows={easyRead ? 3 : 2}
              placeholder={t("assistant.placeholder")}
              aria-label={t("assistant.placeholder")}
              className="min-h-[3rem] flex-1"
            />
            <Button type="submit" disabled={isSending || input.trim().length < 2} size="lg" aria-label={t("assistant.send")}>
              {isSending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Send aria-hidden="true" />}
              <span className="sr-only sm:not-sr-only">{t("assistant.send")}</span>
            </Button>
          </form>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
            <span>{t("assistant.groundedNote")}</span>
            <div className="flex items-center gap-3">
              <span>
                {isMock ? t("summary.mockNotice") : providerName}
              </span>
              {messages.length > 0 && (
                <button
                  type="button"
                  onClick={clearChat}
                  className="inline-flex items-center gap-1 font-medium text-ink-600 underline underline-offset-4 hover:text-ink-800"
                >
                  <Trash2 className="size-3.5" aria-hidden="true" />
                  {t("assistant.clearChat")}
                </button>
              )}
            </div>
          </div>
        </div>
      </Card>

      <aside className="space-y-4">
        <Card>
          <CardContent className="space-y-3">
            <h2 className="flex items-center gap-2 font-semibold text-ink-900">
              <Sparkles className="size-5 text-brand-600" aria-hidden="true" />
              {t("assistant.suggestedQuestions")}
            </h2>
            <ul className="space-y-2">
              {SUGGESTION_KEYS.map((key) => (
                <li key={key}>
                  <button
                    type="button"
                    onClick={() => void send(t(key))}
                    className="w-full rounded-xl border border-ink-200 px-3 py-2.5 text-left text-sm leading-snug text-ink-700 transition-colors hover:border-brand-200 hover:bg-brand-50 hover:text-brand-800 focus-visible:outline-3 focus-visible:outline-brand-500"
                  >
                    {t(key)}
                  </button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Alert variant="brand">
          <div>
            <p className="font-semibold">{t("assistant.askADoctor")}</p>
            <p className="mt-1 text-sm">{t("assistant.askADoctorBody")}</p>
          </div>
        </Alert>
      </aside>
    </div>
  );
}
