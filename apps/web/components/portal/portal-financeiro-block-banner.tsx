"use client";

import Link from "next/link";
import {
  PORTAL_BLOQUEIO_FINANCEIRO_BANNER_LINK,
  PORTAL_BLOQUEIO_FINANCEIRO_BANNER_PREFIX,
} from "@/lib/portal-financeiro-block";
import { usePortalClienteAuthStore } from "@/stores/portalClienteAuthStore";

export function PortalFinanceiroBlockBanner() {
  const blocked = usePortalClienteAuthStore((s) => s.isBloqueadoFinanceiramente);
  if (!blocked) return null;

  return (
    <div
      role="alert"
      className="border-b border-amber-500/60 bg-amber-400 px-4 py-3 text-center text-sm font-medium text-zinc-900"
    >
      {PORTAL_BLOQUEIO_FINANCEIRO_BANNER_PREFIX}{" "}
      <Link href="/portal/financeiro" className="font-semibold underline underline-offset-2 hover:text-black">
        [{PORTAL_BLOQUEIO_FINANCEIRO_BANNER_LINK}]
      </Link>
      .
    </div>
  );
}
