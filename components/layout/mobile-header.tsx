import Link from "next/link";
import { BookOpenText, LibraryBig, Settings2 } from "lucide-react";
import type { Route } from "next";

import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";

const links: Array<{ href: Route; label: string; icon: typeof LibraryBig }> = [
  { href: "/library", label: "Library", icon: LibraryBig },
  { href: "/reader", label: "Reader", icon: BookOpenText },
  { href: "/settings", label: "Settings", icon: Settings2 },
];

export function MobileHeader() {
  return (
    <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur-xl lg:hidden">
      <div className="flex h-16 items-center justify-between px-4 sm:px-6">
        <Logo compact />
        <div className="flex items-center gap-1">
          {links.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              aria-label={label}
              className="flex size-9 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Icon className="size-4" />
            </Link>
          ))}
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
