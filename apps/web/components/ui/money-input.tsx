"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { formatContabil, parseMoeda, simboloMoeda } from "@/lib/financeiro/format";

export type MoneyInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value" | "type"> & {
  value: string;
  onChange: (value: string) => void;
  onCommit?: (formatted: string, amount: number) => void;
};

const MoneyInput = React.forwardRef<HTMLInputElement, MoneyInputProps>(
  ({ className, value, onChange, onCommit, disabled, onBlur, ...props }, ref) => {
    const simbolo = simboloMoeda();

    return (
      <div
        className={cn(
          "flex h-10 w-full items-center rounded-lg border border-white/10 bg-black/30",
          "focus-within:ring-2 focus-within:ring-[var(--ring)] focus-within:ring-offset-0",
          disabled && "cursor-not-allowed opacity-50",
          className,
        )}
      >
        <span className="shrink-0 pl-3 pr-1 text-sm tabular-nums text-muted-foreground">{simbolo}</span>
        <input
          ref={ref}
          type="text"
          inputMode="decimal"
          disabled={disabled}
          value={value}
          placeholder="0,00"
          className="h-full min-w-0 flex-1 bg-transparent py-2 pr-3 text-sm tabular-nums text-white placeholder:text-slate-500 outline-none disabled:cursor-not-allowed"
          {...props}
          onChange={(e) => onChange(e.target.value)}
          onBlur={(e) => {
            const n = parseMoeda(e.target.value);
            const formatted = Number.isFinite(n) ? formatContabil(n) : e.target.value;
            if (formatted !== e.target.value) onChange(formatted);
            if (Number.isFinite(n)) onCommit?.(formatted, n);
            onBlur?.(e);
          }}
        />
      </div>
    );
  },
);
MoneyInput.displayName = "MoneyInput";

export { MoneyInput };
