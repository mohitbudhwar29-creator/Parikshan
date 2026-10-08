import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download, CheckCircle2 } from "lucide-react";
import { requireAppContext } from "@/lib/auth/context";
import { getRecordForUser } from "@/lib/database/records";
import { createTranslator, type Locale } from "@/lib/i18n";
import { formatDate } from "@/lib/i18n/format";
import { deleteRecordAction } from "@/lib/actions/records";
import { toRecordView } from "@/lib/records/view";
import { PageHeader } from "@/components/ui/page";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ConfirmForm } from "@/components/ui/confirm-form";
import { RecordEditor } from "@/components/records/record-editor";
import { SummaryPanel } from "@/components/records/summary-panel";
import type { MessageKey } from "@/lib/i18n/en";

export const metadata: Metadata = { title: "Record" };

export default async function RecordPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const { user, prefs } = await requireAppContext();
  const t = createTranslator(prefs.lang);
  const stored = await getRecordForUser(user.id, id);
  if (!stored) {
    return (
      <div className="space-y-4">
        <Alert variant="attention" role="alert">{t("record.notFound")}</Alert>
        <Link href="/timeline" className="inline-flex items-center gap-2 font-semibold text-primary"><ArrowLeft className="size-4" aria-hidden /> {t("nav.timeline")}</Link>
      </div>
    );
  }
  const record = toRecordView(stored);
  const isDraft = record.status === "REVIEW";
  const locale: Locale = prefs.lang;

  return (
    <div className="space-y-6">
      <Link href={isDraft ? "/upload" : "/timeline"} className="inline-flex items-center gap-2 text-sm font-semibold text-primary">
        <ArrowLeft className="size-4" aria-hidden /> {isDraft ? t("nav.upload") : t("nav.timeline")}
      </Link>
      <PageHeader
        title={record.title}
        subtitle={[
          formatDate(new Date(record.recordDate), locale, "long"),
          record.doctorName,
          record.facility,
        ]
          .filter(Boolean)
          .join(" · ")}
        actions={
          <>
            <Badge variant={isDraft ? "warning" : "info"}>{isDraft ? t("record.draftLabel") : t(`record.type.${record.type}` as MessageKey)}</Badge>
          </>
        }
      />

      {query.saved ? (
        <Alert variant="success" role="status">
          <CheckCircle2 className="size-5 shrink-0" aria-hidden /> {t("record.savedBanner")}
        </Alert>
      ) : null}

      {record.hasFile ? (
        <a
          href={`/api/records/${record.id}/file`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex w-fit items-center gap-2 rounded-xl border border-input bg-card px-4 py-2 text-sm font-semibold hover:bg-accent"
        >
          <Download className="size-4" aria-hidden /> {t("record.openDocument")}
          {record.fileName ? <span className="font-normal text-muted-foreground">({record.fileName})</span> : null}
        </a>
      ) : null}

      <RecordEditor record={record} />

      {!isDraft ? <SummaryPanel recordId={record.id} initial={record.summary} /> : null}

      <section className="rounded-2xl border border-attention/30 bg-attention-soft/40 p-5">
        <ConfirmForm action={deleteRecordAction.bind(null, record.id)} message={t("record.deleteConfirm")}>
          <Button type="submit" variant="danger">
            {t("record.delete")}
          </Button>
        </ConfirmForm>
      </section>
    </div>
  );
}
