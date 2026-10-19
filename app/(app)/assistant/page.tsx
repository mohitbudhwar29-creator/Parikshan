import type { Metadata } from "next";
import { requireAppContext } from "@/lib/auth/context";
import { listSavedRecords } from "@/lib/database/records";
import { createTranslator } from "@/lib/i18n";
import { publicVoiceModes } from "@/lib/voice/config";
import { PageHeader } from "@/components/ui/page";
import { AssistantChat } from "@/components/assistant/chat";

export const metadata: Metadata = { title: "AI Health Assistant" };

export default async function AssistantPage() {
  const { profile, prefs } = await requireAppContext();
  const t = createTranslator(prefs.lang);
  const records = await listSavedRecords(profile.id, 1);
  // Only the resolved modes ("browser" | "server" | "off") reach the browser. Keys stay on the server.
  const modes = publicVoiceModes();
  return (
    <div className="space-y-6">
      <PageHeader title={t("assistant.title")} subtitle={t("assistant.subtitle")} />
      <AssistantChat hasRecords={records.length > 0} sttMode={modes.stt} ttsMode={modes.tts} />
    </div>
  );
}
