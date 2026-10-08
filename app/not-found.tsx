import Link from "next/link";
import { getServerPrefs } from "@/lib/prefs/server";
import { createTranslator } from "@/lib/i18n";
import { Button } from "@/components/ui/button";

export default async function NotFound() {
  const t = createTranslator((await getServerPrefs()).lang);
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-24 text-center">
      <p className="text-6xl font-extrabold text-primary">404</p>
      <h1 className="text-2xl font-bold">{t("error.notFoundTitle")}</h1>
      <p className="text-muted-foreground">{t("error.notFoundBody")}</p>
      <Link href="/dashboard"><Button>{t("error.goDashboard")}</Button></Link>
    </div>
  );
}
