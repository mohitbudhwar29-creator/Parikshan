"use client";

import { ShieldCheck } from "lucide-react";
import { usePrefs } from "@/components/prefs/prefs-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { SpeechMode } from "@/lib/voice/config";

/** Set once the user accepts the voice notice in this browser. Clearing site data withdraws it. */
export const VOICE_CONSENT_KEY = "phc_voice_consent";

/**
 * Shown the first time the user presses the microphone. Explains where the audio goes before any
 * microphone access is requested. Accepting is part of the same click that starts listening.
 */
export function VoiceConsent({ sttMode, onAccept, onCancel }: { sttMode: SpeechMode; onAccept: () => void; onCancel: () => void }) {
  const { t } = usePrefs();
  return (
    <Card role="region" aria-labelledby="voice-consent-title" className="border-primary/40">
      <CardContent className="space-y-3 p-4">
        <p id="voice-consent-title" className="flex items-center gap-2 font-semibold">
          <ShieldCheck className="size-5 text-primary" aria-hidden /> {t("voice.consent.title")}
        </p>
        <p className="text-sm leading-relaxed">{t(sttMode === "server" ? "voice.consent.server" : "voice.consent.browser")}</p>
        <p className="text-sm leading-relaxed text-muted-foreground">{t("voice.consent.common")}</p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            onClick={() => {
              window.localStorage.setItem(VOICE_CONSENT_KEY, "1");
              onAccept();
            }}
          >
            {t("voice.consent.accept")}
          </Button>
          <Button type="button" variant="ghost" onClick={onCancel}>
            {t("common.cancel")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
