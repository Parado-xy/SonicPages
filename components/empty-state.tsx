import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Card } from "@/components/ui/card";

export function EmptyState({
  icon: Icon,
  title,
  description,
  footer,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  footer?: ReactNode;
}) {
  return (
    <Card className="flex min-h-[28rem] flex-col items-center justify-center px-6 py-14 text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
        <Icon className="size-7" aria-hidden="true" />
      </div>
      <h2 className="mt-5 text-xl font-semibold tracking-tight">{title}</h2>
      <p className="mt-3 max-w-lg text-sm leading-6 text-muted-foreground">{description}</p>
      {footer ? <div className="mt-6">{footer}</div> : null}
    </Card>
  );
}
