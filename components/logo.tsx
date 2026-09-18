import Link from "next/link";
import { AudioLines } from "lucide-react";

import { cn } from "@/lib/utils";

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="group flex items-center gap-3" aria-label="SonicPages home">
      <span className="flex size-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm transition-transform group-hover:-rotate-2">
        <AudioLines className="size-5" aria-hidden="true" />
      </span>
      <span className={cn("text-lg font-semibold tracking-[-0.03em]", compact && "hidden min-[390px]:block")}>
        SonicPages
      </span>
    </Link>
  );
}
