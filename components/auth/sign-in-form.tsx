"use client";

import { useState } from "react";
import { Mail } from "lucide-react";

import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

export function SignInForm({
  googleEnabled,
  emailEnabled,
}: {
  googleEnabled: boolean;
  emailEnabled: boolean;
}) {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function signInWithGoogle() {
    setPending(true);
    setMessage(null);
    const result = await authClient.signIn.social({
      provider: "google",
      callbackURL: "/library",
      errorCallbackURL: "/sign-in?error=oauth",
    });
    if (result.error) {
      setMessage("Google sign-in could not be started. Please try again.");
      setPending(false);
    }
  }

  async function requestMagicLink(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage(null);
    const result = await authClient.signIn.magicLink({
      email,
      callbackURL: "/library",
      errorCallbackURL: "/sign-in?error=email",
    });
    setPending(false);
    setMessage(
      result.error
        ? "The sign-in link could not be sent. Please try again."
        : "Check your inbox for a secure SonicPages sign-in link.",
    );
  }

  return (
    <div className="mt-7 space-y-3">
      {googleEnabled ? (
        <Button className="w-full" type="button" variant="outline" onClick={signInWithGoogle} disabled={pending}>
          Continue with Google
        </Button>
      ) : null}

      {emailEnabled ? (
        <form onSubmit={requestMagicLink} className="space-y-3">
          <label htmlFor="email" className="text-sm font-medium">Email address</label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            className="h-11 w-full rounded-xl border bg-background px-3 text-sm"
          />
          <Button className="w-full" type="submit" disabled={pending}>
            <Mail className="size-4" /> {pending ? "Sending…" : "Email me a sign-in link"}
          </Button>
        </form>
      ) : null}

      {message ? (
        <p className="rounded-xl bg-muted px-3 py-2 text-sm text-muted-foreground" role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}
