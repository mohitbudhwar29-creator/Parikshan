"use client";

import * as React from "react";
import Link from "next/link";
import { usePrefs } from "@/components/prefs/prefs-provider";
import { Button } from "@/components/ui/button";

/** Page-level error boundary. It never shows the error message or stack, because they may contain personal data. */
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = usePrefs();
  React.useEffect(() => {
    // Only the fact of an error is logged: no message, no page content.
    console.error("[phc] page error boundary triggered");
  }, []);
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-24 text-center" role="alert">
      <h1 className="text-2xl font-bold">{t("error.boundary")}</h1>
      <p className="text-muted-foreground">{t("error.tryAgainHelp")}</p>
      <div className="flex flex-wrap justify-center gap-3">
        <Button onClick={() => reset()}>{t("common.tryAgain")}</Button>
        <Link href="/dashboard" className="inline-flex h-10 items-center rounded-xl border border-input bg-card px-4 text-sm font-semibold hover:bg-accent">
          {t("error.goDashboard")}
        </Link>
      </div>
    </div>
  );
}
