"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Bot,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  Menu,
  Pill,
  Settings,
  ShieldAlert,
  Upload,
  Users,
  X,
  History,
} from "lucide-react";
import { usePrefs } from "@/components/prefs/prefs-provider";
import { MOBILE_PRIMARY_HREFS, NAV_ITEMS, type NavIconName } from "./nav-config";
import { cn } from "@/lib/utils";

const ICONS: Record<NavIconName, React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>> = {
  dashboard: LayoutDashboard,
  upload: Upload,
  timeline: History,
  assistant: Bot,
  trends: Activity,
  medications: Pill,
  interactions: ShieldAlert,
  family: Users,
  settings: Settings,
};

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Desktop sidebar (full on large screens, icon rail on tablets or when collapsed) and the phone bottom bar. */
export function AppNav({ profileName }: { profileName: string }) {
  const { t } = usePrefs();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = React.useState(false);
  const [moreOpen, setMoreOpen] = React.useState(false);

  React.useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  const primary = NAV_ITEMS.filter((item) => MOBILE_PRIMARY_HREFS.includes(item.href));

  return (
    <>
      <aside
        aria-label={t("nav.mainLabel")}
        className={cn(
          "sticky top-0 hidden h-screen shrink-0 flex-col border-r border-border bg-card md:flex",
          collapsed ? "w-[76px]" : "w-[76px] lg:w-64",
        )}
      >
        <div className={cn("flex items-center justify-between gap-2 px-3 py-4", !collapsed && "lg:px-4")}>
          <span className={cn("text-sm font-semibold text-muted-foreground", collapsed ? "hidden" : "hidden lg:inline")}>
            {t("app.name")}
          </span>
          <button
            type="button"
            onClick={() => setCollapsed((value) => !value)}
            aria-label={collapsed ? t("nav.expand") : t("nav.collapse")}
            className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            {collapsed ? <ChevronRight className="size-5" aria-hidden /> : <ChevronLeft className="size-5" aria-hidden />}
          </button>
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-2">
          {NAV_ITEMS.map((item) => {
            const Icon = ICONS[item.icon];
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                title={t(item.labelKey)}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                  active ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-accent",
                  collapsed && "justify-center px-0",
                )}
              >
                <Icon className="size-5 shrink-0" aria-hidden />
                <span className={cn(collapsed ? "sr-only" : "sr-only lg:not-sr-only")}>{t(item.labelKey)}</span>
              </Link>
            );
          })}
        </nav>
        <Link
          href="/family"
          className={cn("m-2 flex items-center gap-3 rounded-xl border border-border p-3 text-sm hover:bg-accent", collapsed && "justify-center p-2")}
          title={profileName}
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-bold text-secondary-foreground">
            {profileName.charAt(0).toUpperCase()}
          </span>
          <span className={cn("min-w-0 truncate font-medium", collapsed ? "sr-only" : "sr-only lg:not-sr-only")}>{profileName}</span>
        </Link>
      </aside>

      <nav
        aria-label={t("nav.mobileLabel")}
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        <ul className="grid grid-cols-6">
          {primary.map((item) => {
            const Icon = ICONS[item.icon];
            const active = isActive(pathname, item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-[60px] flex-col items-center justify-center gap-0.5 px-1 text-[11px] font-semibold",
                    active ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  <Icon className="size-5" aria-hidden />
                  <span className="truncate">{t(item.shortLabelKey ?? item.labelKey)}</span>
                </Link>
              </li>
            );
          })}
          <li>
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              aria-expanded={moreOpen}
              className="flex min-h-[60px] w-full flex-col items-center justify-center gap-0.5 px-1 text-[11px] font-semibold text-muted-foreground"
            >
              <Menu className="size-5" aria-hidden />
              <span>{t("nav.more")}</span>
            </button>
          </li>
        </ul>
      </nav>

      {moreOpen ? (
        <div className="fixed inset-0 z-50 flex items-end bg-black/40 md:hidden" role="presentation" onClick={() => setMoreOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t("nav.menu")}
            onClick={(event) => event.stopPropagation()}
            className="max-h-[85vh] w-full overflow-y-auto rounded-t-3xl bg-card p-4 pb-8"
          >
            <div className="mb-3 flex items-center justify-between">
              <p className="text-lg font-bold">{t("nav.menu")}</p>
              <button type="button" onClick={() => setMoreOpen(false)} className="rounded-lg p-2 hover:bg-accent" aria-label={t("common.close")}>
                <X className="size-5" aria-hidden />
              </button>
            </div>
            <ul className="grid grid-cols-2 gap-2">
              {NAV_ITEMS.map((item) => {
                const Icon = ICONS[item.icon];
                const active = isActive(pathname, item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex min-h-[56px] items-center gap-3 rounded-xl border border-border p-3 text-sm font-semibold",
                        active && "border-primary bg-accent",
                      )}
                    >
                      <Icon className="size-5 shrink-0" aria-hidden />
                      {t(item.labelKey)}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      ) : null}
    </>
  );
}
