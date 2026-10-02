"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { Toaster } from "sonner";
import { resolveAppliedTheme, type ThemeMode } from "@/lib/theme-scope";
import { useThemeStore } from "@/stores/portal-store";

function applyThemeClass(mode: ThemeMode) {
  const root = document.documentElement;
  root.classList.toggle("dark", mode === "dark");
  root.classList.toggle("light", mode === "light");
  root.dataset.theme = mode;
  root.style.colorScheme = mode;
}

export function ThemeRoot() {
  const pathname = usePathname();
  const storedMode = useThemeStore((s) => s.mode);
  const mode = resolveAppliedTheme(pathname, storedMode);

  useEffect(() => {
    applyThemeClass(mode);
  }, [mode]);

  return <Toaster richColors position="top-center" theme={mode} />;
}
