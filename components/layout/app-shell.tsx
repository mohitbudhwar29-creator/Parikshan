import Link from "next/link";
import { Heart } from "lucide-react";
import { createTranslator } from "@/lib/i18n";
import { logoutAction } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { AppNav } from "./app-nav";
import { LanguageToggle } from "./language-toggle";
import { ReadAloud } from "./read-aloud";
import type { Prefs } from "@/lib/prefs/prefs";

/** Shared chrome for signed-in screens: header, navigation and the main content area. */
export function AppShell({
  children,
  prefs,
  profileName,
  userName,
  isDemo,
}: {
  children: React.ReactNode;
  prefs: Prefs;
  profileName: string;
  userName: string;
  isDemo: boolean;
}) {
  const t = createTranslator(prefs.lang);
  return (
    <div className="flex min-h-screen">
      <AppNav profileName={profileName} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur">
          <div className="flex items-center justify-between gap-3 px-4 py-3 md:px-8">
            <Link href="/dashboard" className="flex items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                <Heart className="size-5" aria-hidden />
              </span>
              <span className="leading-tight">
                <span className="block text-sm font-bold">{t("app.name")}</span>
                <span className="hidden text-xs text-muted-foreground sm:block">{isDemo ? t("common.demoBadge") : userName}</span>
              </span>
            </Link>
            <div className="flex items-center gap-2">
              <ReadAloud />
              <LanguageToggle />
              <form action={logoutAction}>
                <Button variant="ghost" size="sm" type="submit" aria-label={t("nav.signOut")}>
                  <span className="hidden sm:inline">{t("nav.signOut")}</span>
                  <span className="sm:hidden">⎋</span>
                </Button>
              </form>
            </div>
          </div>
        </header>
        <main id="main" data-read-aloud-root tabIndex={-1} className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 pb-28 md:px-8 md:pb-12">
          {children}
        </main>
      </div>
    </div>
  );
}
