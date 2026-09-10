"use client";

import { useEffect, useState } from "react";
import {
  fetchEmpresaBrandingPublico,
  type EmpresaBrandingPublico,
  type EmpresaLogoSlot,
} from "@/lib/api/empresa-client";

let cache: EmpresaBrandingPublico | null = null;
let inflight: Promise<EmpresaBrandingPublico | null> | null = null;

async function loadBranding() {
  if (cache) return cache;
  if (!inflight) {
    inflight = fetchEmpresaBrandingPublico().then((data) => {
      cache = data;
      inflight = null;
      return data;
    });
  }
  return inflight;
}

export function invalidateEmpresaBranding() {
  cache = null;
}

export function useEmpresaBranding() {
  const [branding, setBranding] = useState<EmpresaBrandingPublico | null>(cache);

  useEffect(() => {
    let on = true;
    void loadBranding().then((data) => {
      if (on) setBranding(data);
    });
    return () => {
      on = false;
    };
  }, []);

  return branding;
}

export function resolveBrandLogoUrl(
  branding: EmpresaBrandingPublico | null | undefined,
  slot: EmpresaLogoSlot = "icone",
): string | null {
  if (!branding) return null;
  const chain: EmpresaLogoSlot[] =
    slot === "icone"
      ? ["icone"]
      : slot === "horizontal"
        ? ["horizontal", "icone"]
        : slot === "portal"
          ? ["portal", "horizontal", "icone"]
          : slot === "documento"
            ? ["documento", "horizontal", "icone"]
            : ["email", "horizontal", "icone"];
  for (const s of chain) {
    const url = branding.logos[s]?.url;
    if (url) return url;
  }
  return null;
}
