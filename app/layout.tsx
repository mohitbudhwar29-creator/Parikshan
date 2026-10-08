import type { Metadata, Viewport } from "next";
import "./globals.css";
import { cn } from "@/lib/utils";
import { getServerPrefs } from "@/lib/prefs/server";
import { createTranslator } from "@/lib/i18n";
import { PrefsProvider } from "@/components/prefs/prefs-provider";
import { DisclaimerBar } from "@/components/layout/disclaimer-bar";

export const metadata: Metadata = {
  title: { default: "Personal Health Copilot", template: "%s · Personal Health Copilot" },
  description: "Understand your health records in plain language. Hackathon demo with fictional data.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#1f6f68",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const prefs = await getServerPrefs();
  const t = createTranslator(prefs.lang);
  return (
    <html
      lang={prefs.lang}
      className={cn(prefs.largeText && "large-text", prefs.easyRead && "easy-read", prefs.highContrast && "high-contrast")}
    >
      <body className="font-sans antialiased">
        <PrefsProvider initial={prefs}>
          <a href="#main" className="sr-only-focusable fixed left-2 top-2 z-[60] rounded-lg bg-card px-3 py-2 text-sm font-semibold shadow">
            {t("a11y.skipToContent")}
          </a>
          <DisclaimerBar />
          {children}
        </PrefsProvider>
      </body>
    </html>
  );
}
