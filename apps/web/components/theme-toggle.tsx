"use client";

import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useThemeStore } from "@/stores/portal-store";

export function ThemeToggle({ className }: { className?: string }) {
  const mode = useThemeStore((s) => s.mode);
  const toggleMode = useThemeStore((s) => s.toggleMode);
  const light = mode === "light";

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className={cn("shrink-0", className)}
      aria-label={light ? "Ativar modo escuro" : "Ativar modo claro"}
      title={light ? "Modo escuro" : "Modo claro"}
      onClick={() => toggleMode()}
    >
      {light ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
    </Button>
  );
}
