import type { Metadata } from "next";
import { requireAppContext } from "@/lib/auth/context";
import { listDraftRecords } from "@/lib/database/records";
import { createTranslator } from "@/lib/i18n";
import { PageHeader } from "@/components/ui/page";
import { UploadPanel } from "@/components/upload/upload-panel";

export const metadata: Metadata = { title: "Upload" };

export default async function UploadPage() {
  const { profile, prefs } = await requireAppContext();
  const t = createTranslator(prefs.lang);
  const drafts = await listDraftRecords(profile.id);
  return (
    <div className="space-y-6">
      <PageHeader title={t("upload.title")} subtitle={t("upload.subtitle")} />
      <UploadPanel
        profileId={profile.id}
        profileName={profile.name}
        drafts={drafts.map((draft) => ({ id: draft.id, title: draft.title, recordDate: draft.recordDate.toISOString() }))}
      />
    </div>
  );
}
