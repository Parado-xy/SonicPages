import { ShieldCheck } from "lucide-react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { SignInForm } from "@/components/auth/sign-in-form";
import { Logo } from "@/components/logo";
import { Card } from "@/components/ui/card";
import { getAuthCapabilities } from "@/lib/env";

export const metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

export default async function SignInPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session?.user) {
    redirect("/library");
  }

  const capabilities = getAuthCapabilities();
  const configured = capabilities.google || capabilities.email;

  return (
    <div className="mx-auto flex min-h-[75vh] w-full max-w-md flex-col justify-center">
      <div className="mb-7 flex justify-center"><Logo /></div>
      <Card className="p-6 sm:p-8">
        <h1 className="text-center text-2xl font-semibold tracking-tight">Welcome to SonicPages</h1>
        <p className="mt-2 text-center text-sm leading-6 text-muted-foreground">
          Sign in to keep your future library private and synchronized.
        </p>

        <SignInForm googleEnabled={capabilities.google} emailEnabled={capabilities.email} />

        {!configured ? (
          <div className="mt-7 rounded-2xl border bg-muted p-4 text-sm leading-6 text-muted-foreground">
            Authentication providers have not been configured for this environment yet.
            Follow the setup instructions in the repository README.
          </div>
        ) : null}

        <div className="mt-6 flex items-start gap-3 border-t pt-5 text-xs leading-5 text-muted-foreground">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
          SonicPages uses passwordless authentication and never stores account passwords.
        </div>
      </Card>
    </div>
  );
}
