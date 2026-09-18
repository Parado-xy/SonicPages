import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-3xl border bg-card text-card-foreground shadow-[0_10px_35px_-28px_rgba(12,36,24,0.5)]", className)}
      {...props}
    />
  );
}
