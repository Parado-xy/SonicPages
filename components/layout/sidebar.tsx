import type { Route } from "next";

import { Logo } from "@/components/logo";
import { NavLink } from "@/components/nav-link";
import { ThemeToggle } from "@/components/theme-toggle";

const navigation: Array<{ href: Route; label: string; icon: "home" | "library" | "reader" | "settings" }> = [
  { href: "/", label: "Home", icon: "home" },
  { href: "/library", label: "Library", icon: "library" },
  { href: "/reader", label: "Reader", icon: "reader" },
  { href: "/settings", label: "Settings", icon: "settings" },
];

export function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 border-r bg-card/88 px-5 py-6 backdrop-blur-xl lg:flex lg:flex-col">
      <Logo />
      <nav className="mt-10 space-y-1" aria-label="Primary navigation">
        {navigation.map((item) => <NavLink key={item.href} {...item} />)}
      </nav>
      <div className="mt-auto rounded-2xl border bg-background/75 p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Foundation</p>
        <p className="mt-2 text-sm leading-5 text-muted-foreground">
          The new SonicPages experience is taking shape.
        </p>
      </div>
      <div className="mt-4 flex items-center justify-between px-1">
        <span className="text-xs text-muted-foreground">Appearance</span>
        <ThemeToggle />
      </div>
    </aside>
  );
}
