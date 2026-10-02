"use client";

import { useEffect } from "react";
import { useEmpresaBranding } from "@/hooks/use-empresa-branding";
import { setIdiomaPadrao, setMoedaCorrente } from "@/lib/financeiro/format";

/** Aplica moeda e idioma do tenant (Super Admin) em formatadores e no documento. */
export function MoedaCorrenteSync() {
  const branding = useEmpresaBranding();
  useEffect(() => {
    setMoedaCorrente(branding?.moedaCorrente);
    setIdiomaPadrao(branding?.idiomaPadrao);
    if (branding?.idiomaPadrao) {
      document.documentElement.lang = branding.idiomaPadrao;
    }
  }, [branding?.moedaCorrente, branding?.idiomaPadrao]);
  return null;
}
