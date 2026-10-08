"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { createTranslator, type Translator } from "@/lib/i18n";
import { mergePrefs, type Prefs, type PrefsPatch } from "@/lib/prefs/prefs";
import { updatePrefsAction } from "@/lib/actions/prefs";

interface PrefsContextValue {
  prefs: Prefs;
  t: Translator;
  setPrefs: (patch: PrefsPatch) => void;
}

const PrefsContext = React.createContext<PrefsContextValue | null>(null);

/**
 * Holds the user's preferences on the client so changes apply instantly (text size, contrast, language),
 * and saves them to the cookie through a server action so the next server render matches.
 */
export function PrefsProvider({ initial, children }: { initial: Prefs; children: React.ReactNode }) {
  const router = useRouter();
  const [prefs, setLocal] = React.useState<Prefs>(initial);

  React.useEffect(() => {
    setLocal(initial);
  }, [initial]);

  React.useEffect(() => {
    const root = document.documentElement;
    root.lang = prefs.lang;
    root.classList.toggle("large-text", prefs.largeText);
    root.classList.toggle("easy-read", prefs.easyRead);
    root.classList.toggle("high-contrast", prefs.highContrast);
  }, [prefs]);

  const setPrefs = React.useCallback(
    (patch: PrefsPatch) => {
      setLocal((current) => mergePrefs(patch, current));
      void updatePrefsAction(patch).then(() => router.refresh());
    },
    [router],
  );

  const value = React.useMemo<PrefsContextValue>(
    () => ({ prefs, t: createTranslator(prefs.lang), setPrefs }),
    [prefs, setPrefs],
  );

  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>;
}

export function usePrefs(): PrefsContextValue {
  const value = React.useContext(PrefsContext);
  if (!value) throw new Error("usePrefs must be used inside PrefsProvider");
  return value;
}
