"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Camera, CheckCircle2, FileUp, Loader2, Circle, Info, Upload } from "lucide-react";
import type { MessageKey } from "@/lib/i18n/en";
import { MAX_UPLOAD_BYTES } from "@/lib/upload/limits";
import { usePrefs } from "@/components/prefs/prefs-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/i18n/format";
import { cn } from "@/lib/utils";

type Stage = "reading" | "extracting" | "understanding" | "preparing";
const STAGES: Stage[] = ["reading", "extracting", "understanding", "preparing"];
const ACCEPTED = ["image/jpeg", "image/png", "application/pdf"];

type StreamEvent = { stage: Stage } | { stage: "done"; recordId: string } | { stage: "error"; errorKey: string };

export interface DraftSummary {
  id: string;
  title: string;
  recordDate: string;
}

/** Handles upload, the streamed processing states, and the hand-off to the review screen. */
export function UploadPanel({ profileId, profileName, drafts }: { profileId: string; profileName: string; drafts: DraftSummary[] }) {
  const { t, prefs } = usePrefs();
  const router = useRouter();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const cameraRef = React.useRef<HTMLInputElement>(null);
  const xhrRef = React.useRef<XMLHttpRequest | null>(null);
  const stageRef = React.useRef<Stage | "uploading" | "done" | null>(null);
  const [dragging, setDragging] = React.useState(false);
  const [fileName, setFileName] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [uploadPercent, setUploadPercent] = React.useState(0);
  const [stage, setStage] = React.useState<Stage | "uploading" | "done" | null>(null);
  const [completed, setCompleted] = React.useState<Set<Stage>>(new Set());
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => () => xhrRef.current?.abort(), []);

  function validate(file: File): string | null {
    if (!ACCEPTED.includes(file.type)) return "upload.errorType";
    if (file.size === 0) return "upload.errorEmpty";
    if (file.size > MAX_UPLOAD_BYTES) return "upload.errorSize";
    return null;
  }

  function startUpload(file: File) {
    const problem = validate(file);
    setError(null);
    if (problem) {
      setError(t(problem as MessageKey));
      return;
    }
    setFileName(file.name);
    setBusy(true);
    setUploadPercent(0);
    stageRef.current = "uploading";
    setStage("uploading");
    setCompleted(new Set());

    const body = new FormData();
    body.append("file", file);
    body.append("profileId", profileId);

    const xhr = new XMLHttpRequest();
    xhrRef.current = xhr;
    xhr.open("POST", "/api/records/upload");
    xhr.setRequestHeader("Accept", "application/x-ndjson");

    let consumed = 0;
    let pending = "";
    let finished = false;

    const handle = (event: StreamEvent) => {
      if (event.stage === "done") {
        finished = true;
        setStage("done");
        router.push(`/records/${event.recordId}`);
        router.refresh();
        return;
      }
      if (event.stage === "error") {
        finished = true;
        setError(t(event.errorKey as MessageKey));
        setBusy(false);
        setStage(null);
        return;
      }
      const previous = stageRef.current;
      if (previous && previous !== "uploading" && previous !== "done") {
        setCompleted((set) => new Set(set).add(previous));
      }
      stageRef.current = event.stage;
      setStage(event.stage);
    };

    const consume = () => {
      const text = xhr.responseText;
      pending += text.slice(consumed);
      consumed = text.length;
      const lines = pending.split("\n");
      pending = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          handle(JSON.parse(line) as StreamEvent);
        } catch {
          // Ignore a malformed line rather than crashing the page.
        }
      }
    };

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) setUploadPercent(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onprogress = consume;
    xhr.onload = () => {
      consume();
      if (!finished) {
        let key = "upload.processingFailed";
        try {
          const body = JSON.parse(xhr.responseText) as { errorKey?: string };
          if (body.errorKey) key = body.errorKey;
        } catch {
          key = xhr.status === 0 ? "upload.errorUpload" : "upload.processingFailed";
        }
        setError(t(key as MessageKey));
        setBusy(false);
        setStage(null);
      }
    };
    xhr.onerror = () => {
      setError(t("upload.errorUpload"));
      setBusy(false);
      setStage(null);
    };
    xhr.send(body);
  }

  function onPick(files: FileList | null) {
    const file = files?.[0];
    if (file) startUpload(file);
  }

  const stageLabel: Record<string, MessageKey> = {
    uploading: "upload.stage.uploading",
    reading: "upload.stage.reading",
    extracting: "upload.stage.extracting",
    understanding: "upload.stage.understanding",
    preparing: "upload.stage.preparing",
    done: "upload.stage.done",
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <Card>
        <CardHeader>
          <CardTitle>{t("upload.forProfile")}: {profileName}</CardTitle>
          <CardDescription>{t("upload.progressNote")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              if (!busy) onPick(event.dataTransfer.files);
            }}
            className={cn(
              "flex flex-col items-center gap-4 rounded-2xl border-2 border-dashed p-8 text-center transition-colors",
              dragging ? "border-primary bg-accent" : "border-border bg-muted/40",
            )}
          >
            <span className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <FileUp className="size-7" aria-hidden />
            </span>
            <div className="space-y-1">
              <p className="text-lg font-semibold">{t("upload.dropTitle")}</p>
              <p className="text-sm text-muted-foreground">{t("upload.supported")}</p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Button onClick={() => inputRef.current?.click()} disabled={busy} size="lg">
                <Upload aria-hidden /> {t("upload.chooseFile")}
              </Button>
              <span className="text-sm text-muted-foreground">{t("upload.dropOr")}</span>
              <Button variant="outline" onClick={() => cameraRef.current?.click()} disabled={busy} size="lg">
                <Camera aria-hidden /> {t("upload.useCamera")}
              </Button>
            </div>
            <p className="max-w-md text-xs text-muted-foreground">{t("upload.cameraHelp")}</p>
            <input
              ref={inputRef}
              type="file"
              accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
              className="sr-only"
              aria-label={t("upload.chooseFile")}
              onChange={(event) => {
                onPick(event.target.files);
                event.target.value = "";
              }}
            />
            <input
              ref={cameraRef}
              type="file"
              accept="image/jpeg,image/png"
              capture="environment"
              className="sr-only"
              aria-label={t("upload.useCamera")}
              onChange={(event) => {
                onPick(event.target.files);
                event.target.value = "";
              }}
            />
          </div>

          {fileName ? (
            <p className="text-sm text-muted-foreground">
              {t("upload.fileSelected")}: <span className="font-medium text-foreground">{fileName}</span>
            </p>
          ) : null}

          {busy || stage ? (
            <section aria-live="polite" aria-label={t("upload.stage.uploading")} className="space-y-4 rounded-2xl border border-border bg-card p-5">
              <ol className="space-y-3">
                {(["uploading", ...STAGES] as const).map((item) => {
                  const isCurrent = stage === item;
                  const isDone = completed.has(item as Stage) || stage === "done";
                  return (
                    <li key={item} className={cn("flex items-center gap-3 text-base", !isCurrent && !isDone && "text-muted-foreground")}>
                      {isDone ? (
                        <CheckCircle2 className="size-5 text-success" aria-hidden />
                      ) : isCurrent ? (
                        <Loader2 className="size-5 animate-spin text-primary" aria-hidden />
                      ) : (
                        <Circle className="size-5" aria-hidden />
                      )}
                      <span className={cn(isCurrent && "font-semibold")}>
                        {item === "uploading" && isCurrent ? `${t("upload.stage.uploading")} ${uploadPercent}%` : t(stageLabel[item] ?? "upload.stage.uploading")}
                      </span>
                    </li>
                  );
                })}
              </ol>
              {busy ? (
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={stage === "uploading" ? uploadPercent : 100}>
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${stage === "uploading" ? uploadPercent : 100}%` }}
                  />
                </div>
              ) : null}
            </section>
          ) : null}

          {error ? (
            <Alert variant="attention" role="alert">
              <Info className="size-5 shrink-0" aria-hidden />
              <div className="space-y-2">
                <p>{error}</p>
                <Button variant="outline" size="sm" onClick={() => { setError(null); inputRef.current?.click(); }}>
                  {t("common.tryAgain")}
                </Button>
              </div>
            </Alert>
          ) : null}

          <Alert variant="info">
            <Info className="size-5 shrink-0" aria-hidden />
            <div className="space-y-1">
              <p>{t("upload.mockNotice")}</p>
              <p>{t("upload.demoHint")}</p>
            </div>
          </Alert>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("upload.reviewTitle")}</CardTitle>
          <CardDescription>{t("upload.reviewSubtitle")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {drafts.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("upload.noDrafts")}</p>
          ) : (
            <ul className="space-y-2">
              {drafts.map((draft) => (
                <li key={draft.id} className="flex items-center justify-between gap-3 rounded-xl border border-border p-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{draft.title}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(new Date(draft.recordDate), prefs.lang, "short")}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="warning">{t("record.draftLabel")}</Badge>
                    <Link href={`/records/${draft.id}`} className="text-sm font-semibold text-primary underline-offset-4 hover:underline">
                      {t("common.openRecord")}
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
