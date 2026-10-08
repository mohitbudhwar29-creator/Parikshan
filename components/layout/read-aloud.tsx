"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePrefs } from "@/components/prefs/prefs-provider";

const MAX_CHARACTERS = 4000;

/** Reads the visible page text aloud with the browser's speech synthesis. Nothing is sent to a server. */
export function ReadAloud() {
  const { prefs, t } = usePrefs();
  const pathname = usePathname();
  const [speaking, setSpeaking] = React.useState(false);
  const [supported, setSupported] = React.useState(true);

  React.useEffect(() => {
    setSupported(typeof window !== "undefined" && "speechSynthesis" in window);
  }, []);

  // Stop speaking when the user moves to another page.
  React.useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }, [pathname]);

  React.useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, []);

  if (!prefs.readAloud) return null;

  function toggle() {
    if (!supported) return;
    const synth = window.speechSynthesis;
    if (speaking) {
      synth.cancel();
      setSpeaking(false);
      return;
    }
    const root = document.querySelector<HTMLElement>("[data-read-aloud-root]");
    const text = (root?.innerText ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_CHARACTERS);
    if (!text) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = prefs.lang === "hi" ? "hi-IN" : "en-IN";
    utterance.rate = prefs.easyRead ? 0.85 : 0.95;
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    setSpeaking(true);
    synth.speak(utterance);
  }

  if (!supported) {
    return <p className="text-xs text-muted-foreground">{t("a11y.readAloudUnsupported")}</p>;
  }

  return (
    <Button variant="outline" size="sm" onClick={toggle} aria-pressed={speaking} aria-label={speaking ? t("common.stopReading") : t("common.readAloud")}>
      {speaking ? <VolumeX aria-hidden /> : <Volume2 aria-hidden />}
      <span className="hidden sm:inline">{speaking ? t("common.stopReading") : t("common.readAloud")}</span>
    </Button>
  );
}
