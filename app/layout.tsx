import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { ThemeProvider } from "@/components/theme-provider";
import { PwaManager } from "@/components/pwa/pwa-manager";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "SonicPages",
    template: "%s · SonicPages",
  },
  description: "Turn documents into a focused reading and listening experience.",
  applicationName: "SonicPages",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "SonicPages", statusBarStyle: "default" },
  icons: { icon: "/logo.svg", apple: "/logo.svg" },
};

export const viewport: Viewport = {
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f8f5" },
    { media: "(prefers-color-scheme: dark)", color: "#0c120f" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <AppShell>{children}</AppShell>
          <PwaManager />
        </ThemeProvider>
      </body>
    </html>
  );
}
