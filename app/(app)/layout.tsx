import { requireAppContext } from "@/lib/auth/context";
import { AppShell } from "@/components/layout/app-shell";

export default async function SignedInLayout({ children }: { children: React.ReactNode }) {
  const { user, profile, prefs } = await requireAppContext();
  return (
    <AppShell prefs={prefs} profileName={profile.name} userName={user.name} isDemo={user.isDemo}>
      {children}
    </AppShell>
  );
}
