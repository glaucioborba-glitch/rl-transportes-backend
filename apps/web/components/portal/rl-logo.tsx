"use client";

import { cn } from "@/lib/utils";
import { resolveBrandLogoUrl, useEmpresaBranding } from "@/hooks/use-empresa-branding";
import type { EmpresaLogoSlot } from "@/lib/api/empresa-client";

type Props = {
  className?: string;
  slot?: EmpresaLogoSlot;
  alt?: string;
};

export function RlLogo({ className, slot = "icone", alt }: Props) {
  const branding = useEmpresaBranding();
  const url = resolveBrandLogoUrl(branding, slot);
  const label = alt || branding?.nome || "RL Transportes";

  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={label}
        className={cn("h-9 w-auto max-w-[160px] object-contain object-left", className)}
      />
    );
  }

  return (
    <div
      className={cn(
        "flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--accent)] to-sky-600 text-sm font-black tracking-tight text-white shadow-lg shadow-[var(--accent)]/25",
        className,
      )}
      aria-label={label}
    >
      RL
    </div>
  );
}
