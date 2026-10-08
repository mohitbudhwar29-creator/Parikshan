import type { Metadata } from "next";
import Link from "next/link";
import { HeartPulse, Users, CheckCircle2, Baby, UserRound } from "lucide-react";
import { requireAppContext } from "@/lib/auth/context";
import { switchProfileAction } from "@/lib/actions/profiles";
import { createTranslator } from "@/lib/i18n";
import { formatDate } from "@/lib/i18n/format";
import type { MessageKey } from "@/lib/i18n/en";
import { PageHeader } from "@/components/ui/page";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { AddProfileForm } from "@/components/family/add-profile-form";

export const metadata: Metadata = { title: "Family Profiles" };

export default async function FamilyPage({ searchParams }: { searchParams: Promise<{ added?: string }> }) {
  const { profile, profiles, prefs } = await requireAppContext();
  const t = createTranslator(prefs.lang);
  const params = await searchParams;

  return (
    <div className="space-y-8">
      <PageHeader
        title={t("family.title")}
        subtitle={t("family.subtitle")}
        actions={
          <Link href="/caregiver">
            <Button variant="outline"><HeartPulse aria-hidden /> {t("family.caregiverCta")}</Button>
          </Link>
        }
      />
      {params.added ? <Alert variant="success" role="status">{t("family.added")}</Alert> : null}

      <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {profiles.map((item) => {
          const isActive = item.id === profile.id;
          const Icon = item.relationship === "CHILD" ? Baby : item.relationship === "SELF" ? UserRound : Users;
          return (
            <li key={item.id}>
              <Card className={isActive ? "border-primary ring-2 ring-primary/20" : undefined}>
                <CardContent className="flex h-full flex-col gap-4 p-5">
                  <div className="flex items-start gap-3">
                    <span className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      <Icon className="size-5" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-lg font-bold">{item.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {t(`family.rel.${item.relationship}` as MessageKey)}
                        {item.dateOfBirth ? ` · ${formatDate(item.dateOfBirth, prefs.lang, "short")}` : ""}
                      </p>
                    </div>
                    {isActive ? <Badge variant="success"><CheckCircle2 className="size-3" aria-hidden /> {t("family.viewing")}</Badge> : null}
                  </div>
                  <p className="text-sm text-muted-foreground">{t("family.records", { count: item._count.records })}</p>
                  <div className="mt-auto flex flex-wrap gap-2">
                    {isActive ? null : (
                      <form action={switchProfileAction.bind(null, item.id)}>
                        <Button type="submit" variant="secondary">{t("family.view")}</Button>
                      </form>
                    )}
                    <Link href="/caregiver" className="inline-flex h-10 items-center rounded-xl px-3 text-sm font-semibold text-primary hover:bg-accent">
                      {t("family.caregiverCta")}
                    </Link>
                  </div>
                </CardContent>
              </Card>
            </li>
          );
        })}
      </ul>

      <AddProfileForm />
    </div>
  );
}
