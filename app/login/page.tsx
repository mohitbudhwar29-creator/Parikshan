import Link from "next/link";
import { Heart, Info, ShieldAlert } from "lucide-react";
import { getServerPrefs } from "@/lib/prefs/server";
import { createTranslator } from "@/lib/i18n";
import { demoLoginAction } from "@/lib/actions/auth";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginForm } from "@/components/auth/login-form";
import { LanguageToggle } from "@/components/layout/language-toggle";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ deleted?: string }> }) {
  const prefs = await getServerPrefs();
  const t = createTranslator(prefs.lang);
  const params = await searchParams;

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
        <Link href="/" className="flex items-center gap-2.5 font-bold">
          <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Heart className="size-5" aria-hidden />
          </span>
          {t("app.name")}
        </Link>
        <LanguageToggle />
      </header>
      <main id="main" className="mx-auto grid max-w-5xl gap-8 px-4 pb-16 pt-6 md:grid-cols-2 md:pt-12">
        <section className="space-y-4">
          <h1 className="text-3xl font-extrabold tracking-tight">{t("login.title")}</h1>
          <p className="text-lg text-muted-foreground">{t("login.subtitle")}</p>
          {params.deleted ? (
            <Alert variant="success" role="status">
              <Info className="size-5 shrink-0" aria-hidden />
              {t("settings.deleted")}
            </Alert>
          ) : null}
          <Alert variant="warning">
            <ShieldAlert className="size-5 shrink-0" aria-hidden />
            <div className="space-y-1">
              <p className="font-semibold">{t("login.abhaReady")}</p>
              <p>{t("login.demoOnly")}</p>
            </div>
          </Alert>
          <p className="text-sm text-muted-foreground">{t("privacy.demoNote")}</p>
        </section>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t("login.continue")}</CardTitle>
              <CardDescription>{t("login.secureNote")}</CardDescription>
            </CardHeader>
            <CardContent>
              <LoginForm />
            </CardContent>
          </Card>

          <Card className="border-primary/30">
            <CardHeader>
              <CardTitle>{t("login.tryDemo")}</CardTitle>
              <CardDescription>{t("login.tryDemoHelp")}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 sm:flex-row">
              <form action={demoLoginAction.bind(null, false)} className="flex-1">
                <Button type="submit" size="lg" className="w-full">
                  {t("login.tryDemo")}
                </Button>
              </form>
              <form action={demoLoginAction.bind(null, true)} className="flex-1">
                <Button type="submit" size="lg" variant="outline" className="w-full">
                  {t("landing.cta.tryDemo")}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
