"use client";

import * as React from "react";
import Link from "next/link";
import { Bot, RotateCcw, Send, ShieldCheck, User } from "lucide-react";
import type { MessageKey } from "@/lib/i18n/en";
import type { AssistantAnswer } from "@/types/health";
import { askAssistantAction } from "@/lib/actions/assistant";
import { usePrefs } from "@/components/prefs/prefs-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Textarea, Label } from "@/components/ui/form";
import { cn } from "@/lib/utils";

interface Message {
  id: number;
  role: "user" | "assistant";
  text: string;
  answer?: AssistantAnswer;
}

const SUGGESTIONS: MessageKey[] = [
  "assistant.question1",
  "assistant.question2",
  "assistant.question3",
  "assistant.question5",
  "assistant.question6",
  "assistant.question9",
];

/** Grounded Q&A over the active profile's saved records. Every answer lists the records it used. */
export function AssistantChat({ hasRecords }: { hasRecords: boolean }) {
  const { t } = usePrefs();
  const [messages, setMessages] = React.useState<Message[]>([
    { id: 0, role: "assistant", text: t("assistant.welcome") },
  ]);
  const [input, setInput] = React.useState("");
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const nextId = React.useRef(1);
  const listRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, pending]);

  function ask(question: string) {
    const trimmed = question.trim();
    if (!trimmed || pending) return;
    setError(null);
    setInput("");
    const userMessage: Message = { id: nextId.current++, role: "user", text: trimmed };
    setMessages((current) => [...current, userMessage]);
    startTransition(async () => {
      const result = await askAssistantAction(trimmed);
      if (!result.ok) {
        setError(t(result.errorKey as MessageKey));
        return;
      }
      setMessages((current) => [
        ...current,
        { id: nextId.current++, role: "assistant", text: result.data.answer, answer: result.data },
      ]);
    });
  }

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
                  <p className="text-xs font-semibold text-muted-foreground">{message.role === "user" ? t("assistant.you") : t("assistant.copilot")}</p>
                  <p className="whitespace-pre-line">{message.text}</p>
                  {message.answer && message.answer.sources.length > 0 ? (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {message.answer.sources.map((source) => (
                        <Link
                          key={`${message.id}-${source.recordId}`}
                          href={`/records/${source.recordId}`}
                          className="rounded-full border border-primary/30 bg-card px-3 py-1 text-xs font-semibold text-primary hover:bg-accent"
                        >
                          {t("assistant.basedOn", { source: source.label })}
                        </Link>
                      ))}
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
            {error ? <Alert variant="attention" role="alert">{error}</Alert> : null}
          </div>

          <form
            className="space-y-3 border-t border-border p-4"
            onSubmit={(event) => {
              event.preventDefault();
              ask(input);
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
                  ask(input);
                }
              }}
            />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Button type="button" variant="ghost" size="sm" onClick={() => setMessages([{ id: 0, role: "assistant", text: t("assistant.welcome") }])}>
                <RotateCcw aria-hidden /> {t("assistant.clear")}
              </Button>
              <Button type="submit" disabled={!hasRecords || pending || input.trim().length === 0}>
                <Send aria-hidden /> {t("assistant.send")}
              </Button>
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
                  onClick={() => ask(t(key))}
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
        {!hasRecords ? <Alert variant="warning">{t("assistant.noRecords")}</Alert> : null}
      </aside>
    </div>
  );
}
