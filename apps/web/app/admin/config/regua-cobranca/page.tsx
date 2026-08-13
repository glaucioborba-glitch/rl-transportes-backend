"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Legado — redireciona para Cadastros › Parâmetros › Financeiro › Régua. */
export default function AdminReguaCobrancaRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/cadastros/parametros/financeiro#regua-cobranca");
  }, [router]);

  return (
    <p className="text-sm text-muted-foreground">Redirecionando para Parâmetros › Financeiro…</p>
  );
}
