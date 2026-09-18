import type { ReactNode } from "react";

import { MobileHeader } from "@/components/layout/mobile-header";
import { Sidebar } from "@/components/layout/sidebar";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <Sidebar />
      <MobileHeader />
      <main className="px-4 py-8 sm:px-6 lg:ml-72 lg:px-10 lg:py-10">{children}</main>
    </div>
  );
}
