"use client";

import { useEffect, useId, useState, type KeyboardEventHandler } from "react";
import { Input } from "@/components/ui/input";
import { fetchPortalCatalogoNavios } from "@/lib/api/portal-client";
import { fetchStaffCatalogoNavios } from "@/lib/gate/operacao-api";
import { cn } from "@/lib/utils";

export type CatalogoNavioSource = "portal" | "staff";

export function NavioAutocompleteInput({
  value,
  onChange,
  source,
  disabled,
  className,
  placeholder,
  onBlur,
  onKeyDown,
}: {
  value: string;
  onChange: (v: string) => void;
  source: CatalogoNavioSource;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
  onBlur?: () => void;
  onKeyDown?: KeyboardEventHandler<HTMLInputElement>;
}) {
  const listId = `navio-${useId().replace(/:/g, "")}`;
  const [items, setItems] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    const t = window.setTimeout(async () => {
      try {
        const r =
          source === "portal"
            ? await fetchPortalCatalogoNavios(value)
            : await fetchStaffCatalogoNavios(value);
        if (!cancelled) setItems(r.items.map((i) => i.nome));
      } catch {
        if (!cancelled) setItems([]);
      }
    }, value.trim() ? 200 : 0);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [value, source]);

  return (
    <>
      <Input
        list={listId}
        value={value}
        disabled={disabled}
        placeholder={placeholder ?? "Nome do navio"}
        autoComplete="off"
        className={cn("bg-black/40", className)}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
      />
      <datalist id={listId}>
        {items.map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>
    </>
  );
}
