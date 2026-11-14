import { createContext, useContext, useState, type ReactNode } from "react";
import { useColorScheme } from "react-native";
import { preference, savePreference } from "../storage/readerStore";
import { dark, light, type Palette } from "./tokens";

type Appearance = "system" | "light" | "dark";
type Theme = { theme: Appearance; palette: Palette; setTheme(value: Appearance): void };
const ThemeContext = createContext<Theme | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [theme, updateTheme] = useState<Appearance>(() => {
    const saved = preference("theme");
    return saved === "light" || saved === "dark" ? saved : "system";
  });
  const palette = (theme === "system" ? system : theme) === "dark" ? dark : light;
  const setTheme = (value: Appearance) => {
    savePreference("theme", value);
    updateTheme(value);
  };
  return <ThemeContext.Provider value={{ theme, palette, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("SonicPages theme provider is missing.");
  return context;
}
