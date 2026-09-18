"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Route } from "next";
import { BookOpenText, Home, LibraryBig, Settings2 } from "lucide-react";

import { cn } from "@/lib/utils";

const icons = { home: Home, library: LibraryBig, reader: BookOpenText, settings: Settings2 };

export function NavLink({
  href,
  label,
  icon,
}: {
  href: Route;
  label: string;
  icon: keyof typeof icons;
}) {
  const pathname = usePathname();
  const active = href === "/" ? pathname === href : pathname.startsWith(href);
  const Icon = icons[icon];

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition-colors",
        active
          ? "bg-accent text-accent-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <Icon className="size-[1.1rem]" aria-hidden="true" />
      {label}
    </Link>
  );
}
