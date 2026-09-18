"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";

const themes = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

export function ThemeToggle({ showLabel = false }: { showLabel?: boolean }) {
  const { theme = "system", setTheme } = useTheme();

  const currentIndex = themes.findIndex((item) => item.value === theme);
  const current = themes[currentIndex === -1 ? 2 : currentIndex];
  const Icon = current.icon;

  function cycleTheme() {
    const next = themes[(currentIndex + 1 + themes.length) % themes.length];
    setTheme(next.value);
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size={showLabel ? "default" : "icon"}
      onClick={cycleTheme}
      aria-label={`Theme: ${current.label}. Change theme`}
      title="Cycle appearance"
      suppressHydrationWarning
    >
      <Icon className="size-4" />
      {showLabel ? current.label : null}
    </Button>
  );
}
