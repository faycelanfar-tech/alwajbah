import { createContext, useContext, useEffect, useState, ReactNode } from "react";

type Theme = "light" | "dark" | "system";

const Ctx = createContext<{ theme: Theme; setTheme: (t: Theme) => void; resolved: "light" | "dark" }>({
  theme: "system",
  setTheme: () => {},
  resolved: "light",
});

const KEY = "app-theme";

function systemDark() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("system");
  const [resolved, setResolved] = useState<"light" | "dark">("light");

  useEffect(() => {
    const saved = (localStorage.getItem(KEY) as Theme | null) ?? "system";
    setThemeState(saved);
  }, []);

  useEffect(() => {
    const apply = () => {
      const dark = theme === "dark" || (theme === "system" && systemDark());
      document.documentElement.classList.toggle("dark", dark);
      document.documentElement.style.colorScheme = dark ? "dark" : "light";
      setResolved(dark ? "dark" : "light");
    };
    apply();
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [theme]);

  const setTheme = (t: Theme) => {
    localStorage.setItem(KEY, t);
    setThemeState(t);
  };

  return <Ctx.Provider value={{ theme, setTheme, resolved }}>{children}</Ctx.Provider>;
}

export const useTheme = () => useContext(Ctx);
