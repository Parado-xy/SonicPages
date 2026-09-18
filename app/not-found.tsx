import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center text-center">
      <p className="text-sm font-semibold text-primary">404</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">This page went quiet</h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        The page may have moved, or the address may be incomplete.
      </p>
      <Link href="/" className={buttonVariants({ className: "mt-6" })}>
        <ArrowLeft className="size-4" /> Back home
      </Link>
    </div>
  );
}
