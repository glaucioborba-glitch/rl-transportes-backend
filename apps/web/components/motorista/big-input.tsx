"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type BigInputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
};

export const BigInput = React.forwardRef<HTMLInputElement, BigInputProps>(
  ({ className, label, id, ...props }, ref) => {
    const inputId = id ?? label.replace(/\s+/g, "-").toLowerCase();
    return (
      <div className="space-y-1.5">
        <label htmlFor={inputId} className="block text-sm font-medium text-slate-300">
          {label}
        </label>
        <input
          ref={ref}
          id={inputId}
          className={cn(
            "h-14 w-full rounded-2xl border-2 border-white/15 bg-black/40 px-4 text-lg text-white placeholder:text-slate-500 focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40",
            className,
          )}
          {...props}
        />
      </div>
    );
  },
);
BigInput.displayName = "BigInput";
