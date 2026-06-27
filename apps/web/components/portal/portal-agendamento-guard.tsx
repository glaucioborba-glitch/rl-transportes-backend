"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { PORTAL_BLOQUEIO_FINANCEIRO_TOAST } from "@/lib/portal-financeiro-block";
import { fetchPortalDashboard } from "@/lib/api/portal-client";
import { usePortalClienteAuthStore } from "@/stores/portalClienteAuthStore";
import { toast } from "@/lib/toast";

/** Redireciona agendamento direto quando bloqueio financeiro ativo. */
export function PortalAgendamentoGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const blocked = usePortalClienteAuthStore((s) => s.isBloqueadoFinanceiramente);
  const hydrated = usePortalClienteAuthStore((s) => s.bloqueioFinanceiroHydrated);
  const setBloqueioFinanceiro = usePortalClienteAuthStore((s) => s.setBloqueioFinanceiro);
  const toastShown = useRef(false);

  useEffect(() => {
    if (hydrated) return;
    void fetchPortalDashboard({ recentPage: 1, recentLimit: 1 })
      .then((dash) => setBloqueioFinanceiro(Boolean(dash.isBloqueadoFinanceiramente)))
      .catch(() => setBloqueioFinanceiro(false));
  }, [hydrated, setBloqueioFinanceiro]);

  useEffect(() => {
    if (!hydrated) return;
    if (!blocked) return;
    if (!toastShown.current) {
      toastShown.current = true;
      toast.error(PORTAL_BLOQUEIO_FINANCEIRO_TOAST);
    }
    router.replace("/portal/dashboard?bloqueioFinanceiro=1");
  }, [blocked, hydrated, router]);

  if (!hydrated) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-slate-400">Verificando pendências…</div>
    );
  }

  if (blocked) return null;

  return <>{children}</>;
}
