"use client";

import { usePortalClienteAuthStore } from "@/stores/portalClienteAuthStore";

export function PortalCadastroPendenteBanner() {
  const pendente = usePortalClienteAuthStore((s) => s.cadastroPendenteAnalise);
  if (!pendente) return null;

  return (
    <div
      role="alert"
      className="border-b border-sky-500/40 bg-sky-950/80 px-4 py-3 text-center text-sm text-sky-100"
    >
      Seu cadastro está em análise pelo financeiro da RL Transportes. Você já pode criar solicitações;
      até a liberação comercial, o pagamento é à vista (PIX), com recebimento antes da coleta.
    </div>
  );
}
