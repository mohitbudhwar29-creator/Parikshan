import type { Metadata } from "next";
import { History } from "lucide-react";
import { requireAppContext } from "@/lib/auth/context";
import { listSavedRecords } from "@/lib/database/records";
import { createTranslator } from "@/lib/i18n";
import { PageHeader } from "@/components/ui/page";
import { EmptyState } from "@/components/ui/empty-state";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { TimelineList, type TimelineEntry } from "@/components/timeline/timeline-list";
import Link from "next/link";

export const metadata: Metadata = { title: "Timeline" };

export default async function TimelinePage({ searchParams }: { searchParams: Promise<{ deleted?: string }> }) {
  const { profile, prefs } = await requireAppContext();
  const t = createTranslator(prefs.lang);
  const params = await searchParams;
  const records = await listSavedRecords(profile.id);
  const entries: TimelineEntry[] = records.map((record) => ({
    id: record.id,
    type: record.type,
    title: record.title,
    recordDate: record.recordDate.toISOString(),
    doctorName: record.doctorName ?? "",
    facility: record.facility ?? "",
    labCount: record._count.labResults,
    medicineCount: record._count.medications,
  }));

  return (
    <div className="space-y-6">
      <PageHeader title={t("timeline.title")} subtitle={t("timeline.subtitle")} />
      {params.deleted ? <Alert variant="success" role="status">{t("record.deleted")}</Alert> : null}
      {entries.length === 0 ? (
        <EmptyState
          icon={<History className="size-6" aria-hidden />}
          title={t("timeline.empty.title")}
          body={t("timeline.empty.body")}
          action={
            <Link href="/upload">
              <Button>{t("dashboard.upload")}</Button>
            </Link>
          }
        />
      ) : (
        <TimelineList entries={entries} />
      )}
    </div>
  );
}
