import Link from "next/link";
import { ArrowRight, Bot, FileUp, Heart, ShieldCheck, Sparkles, Users, Volume2, LineChart, Pill } from "lucide-react";
import { getServerPrefs } from "@/lib/prefs/server";
import { createTranslator } from "@/lib/i18n";
import { demoLoginAction } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LanguageToggle } from "@/components/layout/language-toggle";

export default async function LandingPage() {
  const prefs = await getServerPrefs();
  const t = createTranslator(prefs.lang);
  const features = [
    { icon: Bot, title: t("landing.feature.assistant.title"), body: t("landing.feature.assistant.body") },
    { icon: LineChart, title: t("landing.feature.trends.title"), body: t("landing.feature.trends.body") },
    { icon: Pill, title: t("landing.feature.safety.title"), body: t("landing.feature.safety.body") },
  ];
  const steps = [t("landing.howItWorks.step1"), t("landing.howItWorks.step2"), t("landing.howItWorks.step3")];
  const access = [t("landing.a11y.item1"), t("landing.a11y.item2"), t("landing.a11y.item3"), t("landing.a11y.item4"), t("landing.a11y.item5")];

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 md:px-8">
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Heart className="size-5" aria-hidden />
          </span>
          <span className="font-bold">{t("app.name")}</span>
        </div>
        <div className="flex items-center gap-2">
          <LanguageToggle />
        </div>
      </header>

      <main id="main" className="mx-auto max-w-6xl px-4 pb-16 md:px-8">
        <section className="grid items-center gap-10 py-10 md:grid-cols-2 md:py-16">
          <div className="space-y-6">
            <span className="inline-flex items-center gap-2 rounded-full bg-accent px-3 py-1 text-sm font-semibold text-accent-foreground">
              <Sparkles className="size-4" aria-hidden /> Hackathon prototype · demo data
            </span>
            <h1 className="text-4xl font-extrabold tracking-tight md:text-5xl">{t("landing.hero.title")}</h1>
            <p className="text-xl font-medium text-primary">{t("landing.hero.subtitle")}</p>
            <p className="max-w-xl text-lg text-muted-foreground">{t("landing.hero.body")}</p>
            <div className="flex flex-wrap gap-3">
              <Link href="/login" className="inline-flex h-12 items-center gap-2 rounded-2xl bg-primary px-6 text-base font-semibold text-primary-foreground shadow-sm hover:bg-primary/90">
                {t("landing.cta.start")} <ArrowRight className="size-4" aria-hidden />
              </Link>
              <form action={demoLoginAction.bind(null, true)}>
                <Button type="submit" variant="outline" size="lg">
                  {t("landing.cta.tryDemo")}
                </Button>
              </form>
            </div>
            <p className="flex items-start gap-2 text-sm text-muted-foreground">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
              {t("login.secureNote")}
            </p>
          </div>
          <Card className="overflow-hidden border-primary/20">
            <CardContent className="space-y-4 p-6">
              <p className="text-sm font-semibold text-muted-foreground">{t("landing.howItWorks.title")}</p>
              <ol className="space-y-4">
                {steps.map((step, index) => (
                  <li key={step} className="flex gap-3">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">{index + 1}</span>
                    <span className="pt-1 text-base">{step}</span>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </section>

        <section aria-labelledby="features" className="space-y-6">
          <h2 id="features" className="text-2xl font-bold">{t("landing.features.title")}</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {features.map((feature) => (
              <Card key={feature.title}>
                <CardContent className="space-y-3 p-6">
                  <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <feature.icon className="size-5" aria-hidden />
                  </span>
                  <h3 className="text-lg font-semibold">{feature.title}</h3>
                  <p className="text-muted-foreground">{feature.body}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section aria-labelledby="access" className="mt-12 grid gap-6 rounded-3xl bg-secondary/60 p-6 md:grid-cols-2 md:p-10">
          <div className="space-y-3">
            <h2 id="access" className="text-2xl font-bold">{t("landing.a11y.title")}</h2>
            <p className="text-muted-foreground">{t("privacy.informational")}</p>
          </div>
          <ul className="grid gap-2 text-base">
            {access.map((item) => (
              <li key={item} className="flex items-center gap-2">
                <Volume2 className="size-4 text-primary" aria-hidden />
                {item}
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-12 flex flex-col items-start gap-4 rounded-3xl border border-border bg-card p-6 md:flex-row md:items-center md:justify-between md:p-8">
          <div className="space-y-1">
            <p className="text-lg font-semibold">{t("landing.cta.demo")}</p>
            <p className="text-muted-foreground">{t("landing.footer")}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <form action={demoLoginAction.bind(null, false)}>
              <Button type="submit" variant="secondary">
                <FileUp className="size-4" aria-hidden /> {t("login.tryDemo")}
              </Button>
            </form>
            <Link href="/login" className="inline-flex h-10 items-center gap-2 rounded-xl border border-input bg-card px-4 text-sm font-semibold hover:bg-accent">
              <Users className="size-4" aria-hidden /> {t("landing.signIn")}
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
