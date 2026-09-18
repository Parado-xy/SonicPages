import { MonitorCog, ShieldCheck, UserRound } from "lucide-react";
import { headers } from "next/headers";

import { auth } from "@/auth";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  return (
    <div className="mx-auto w-full max-w-4xl">
      <PageHeader
        eyebrow="Preferences"
        title="Settings"
        description="Control how SonicPages looks and, as features arrive, how it reads."
      />
      <div className="mt-8 grid gap-4">
        <Card className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-4">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
              <UserRound className="size-5" aria-hidden="true" />
            </div>
            <div>
              <h2 className="font-semibold">{session?.user.name ?? "Your account"}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{session?.user.email}</p>
            </div>
          </div>
          <SignOutButton />
        </Card>
        <Card className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-4">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
              <MonitorCog className="size-5" aria-hidden="true" />
            </div>
            <div>
              <h2 className="font-semibold">Appearance</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Choose light, dark, or follow your device.
              </p>
            </div>
          </div>
          <ThemeToggle showLabel />
        </Card>
        <Card className="flex gap-4 p-6">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
            <ShieldCheck className="size-5" aria-hidden="true" />
          </div>
          <div>
            <h2 className="font-semibold">Privacy by design</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Account records are stored in PostgreSQL. Document storage remains disabled
              until the secure ingestion phase.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
