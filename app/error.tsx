"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-red-100 text-danger dark:bg-red-950/40">
        <AlertTriangle className="size-7" aria-hidden="true" />
      </div>
      <h1 className="mt-5 text-2xl font-semibold">Something interrupted the page</h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        Your documents are safe. Try loading this view again.
      </p>
      <Button className="mt-6" onClick={reset}>
        <RotateCcw className="size-4" /> Try again
      </Button>
    </div>
  );
}
