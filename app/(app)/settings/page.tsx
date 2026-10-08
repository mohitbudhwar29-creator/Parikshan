import type { Metadata } from "next";
import Link from "next/link";
import { Download, Eye, LogOut, Shield, Bell, Accessibility, Languages } from "lucide-react";
import { requireAppContext } from "@/lib/auth/context";
import { createTranslator } from "@/lib/i18n";
import { logoutAction } from "@/lib/actions/auth";
import { PageHeader } from "@/components/ui/page";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { PreferenceSwitches } from "@/components/settings/preference-switches";
import { DeleteAccountForm } from "@/components/settings/delete-account-form";
import { LanguageToggle } from "@/components/layout/language-toggle";

export const metadata: Metadata = { title: "Profile & Settings" };

function maskAbha(value: string | null): string {
  if (!value) return "";
  const digits = value.replace(/\D/g, "");
  return `${"••-••••-••••-"}${digits.slice(-4)}`;
}

export default async function SettingsPage() {
  const { user, profile, profiles, prefs } = await requireAppContext();
  const t = createTranslator(prefs.lang);

  return (
    <div className="space-y-6">
      <PageHeader title={t("settings.title")} subtitle={t("settings.subtitle")} />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Languages className="size-5 text-primary" aria-hidden /> {t("settings.language")}</CardTitle>
        </CardHeader>
        <CardContent>
          <LanguageToggle />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Accessibility className="size-5 text-primary" aria-hidden /> {t("settings.accessibility")}</CardTitle>
        </CardHeader>
        <CardContent>
          <PreferenceSwitches
            items={[
              { key: "easyRead", label: t("a11y.easyRead"), hint: t("a11y.easyReadHint") },
              { key: "largeText", label: t("a11y.largeText") },
              { key: "highContrast", label: t("a11y.highContrast") },
              { key: "readAloud", label: t("a11y.readAloud"), hint: t("a11y.readAloudUnsupported") },
            ]}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Bell className="size-5 text-primary" aria-hidden /> {t("settings.notifications")}</CardTitle>
          <CardDescription>{t("settings.notifHint")}</CardDescription>
        </CardHeader>
        <CardContent>
          <PreferenceSwitches
            items={[
              { key: "medicineReminders", label: t("settings.notifMedicine") },
              { key: "recordReminders", label: t("settings.notifRecord") },
            ]}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Shield className="size-5 text-primary" aria-hidden /> {t("settings.security")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="font-semibold text-muted-foreground">{t("settings.abhaNumber")}</dt>
              <dd className="text-base">{user.abhaNumber ? maskAbha(user.abhaNumber) : t("settings.notSet")}</dd>
            </div>
            <div>
              <dt className="font-semibold text-muted-foreground">{t("settings.email")}</dt>
              <dd className="text-base">{user.email}</dd>
            </div>
            <div>
              <dt className="font-semibold text-muted-foreground">{t("settings.profileInfo")}</dt>
              <dd className="text-base">{t("settings.profilesCount", { count: profiles.length })}</dd>
            </div>
            <div>
              <dt className="font-semibold text-muted-foreground">{t("settings.demoAccount")}</dt>
              <dd className="text-base">{user.isDemo ? t("common.demoBadge") : "—"}</dd>
            </div>
          </dl>
          <Alert variant="warning">{t("settings.abhaDemo")}</Alert>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Eye className="size-5 text-primary" aria-hidden /> {t("settings.privacy")}</CardTitle>
          <CardDescription>{t("settings.privacyMessage")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col gap-2">
            <p className="text-sm text-muted-foreground">{t("settings.downloadHelp")}</p>
            <a
              href={`/api/account/export?profileId=${encodeURIComponent(profile.id)}`}
              className="inline-flex h-10 w-fit items-center gap-2 rounded-xl border border-input bg-card px-4 text-sm font-semibold hover:bg-accent"
            >
              <Download className="size-4" aria-hidden /> {t("settings.downloadData")}
            </a>
          </div>
          <div className="space-y-3 rounded-2xl border border-attention/30 p-4">
            <p className="font-semibold">{t("settings.deleteData")}</p>
            <p className="text-sm text-muted-foreground">{t("settings.deleteHelp")}</p>
            <DeleteAccountForm />
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-3">
        <form action={logoutAction}>
          <Button type="submit" variant="outline"><LogOut aria-hidden /> {t("settings.logout")}</Button>
        </form>
        <Link href="/family" className="inline-flex h-10 items-center rounded-xl px-4 text-sm font-semibold text-primary hover:bg-accent">
          {t("nav.family")}
        </Link>
      </div>
    </div>
  );
}
