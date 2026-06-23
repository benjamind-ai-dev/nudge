import { useEffect } from "react";
import { useThemeStore, type ThemeMode } from "../../stores/theme.store";

function resolveEffectiveTheme(mode: ThemeMode): "light" | "dark" {
  if (mode === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return mode;
}

function applyTheme(effective: "light" | "dark") {
  const el = document.documentElement;
  if (effective === "dark") {
    el.classList.add("dark");
  } else {
    el.classList.remove("dark");
  }
}

export function useApplyTheme() {
  const mode = useThemeStore((s) => s.mode);

  useEffect(() => {
    applyTheme(resolveEffectiveTheme(mode));

    if (mode !== "system") return;

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => {
      applyTheme(e.matches ? "dark" : "light");
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [mode]);
}
