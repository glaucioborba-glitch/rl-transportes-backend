"use client";

import Link from "next/link";
import {
  hrefAuditoriaGerencial,
  type ClassificacaoAuditoria,
} from "@/lib/auditoria/classificacao-auditoria";

export function AuditoriaGerencialLink({
  q,
  classificacao,
  label = "Abrir auditoria gerencial",
}: {
  q?: string;
  classificacao?: ClassificacaoAuditoria;
  label?: string;
}) {
  return (
    <Link
      href={hrefAuditoriaGerencial({ q, classificacao })}
      className="text-sm font-medium text-emerald-400 hover:text-emerald-300"
    >
      {label} →
    </Link>
  );
}
