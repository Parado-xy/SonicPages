"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

export function ProcessingRefresh({ active }: { active: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => router.refresh(), 5_000);
    return () => window.clearInterval(timer);
  }, [active, router]);
  return null;
}

export function RetryIngestion({ documentId }: { documentId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  return (
    <Button
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        const response = await fetch(`/api/documents/${documentId}/retry`, { method: "POST" });
        if (response.ok) router.refresh();
        setPending(false);
      }}
    >
      <RefreshCw className={pending ? "size-3.5 animate-spin" : "size-3.5"} />
      Retry
    </Button>
  );
}
