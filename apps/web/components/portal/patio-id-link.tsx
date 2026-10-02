import Link from "next/link";
import type { PortalPatioSaldoItem } from "@/lib/api/portal-client";

export function PatioIdLink({ item }: { item: PortalPatioSaldoItem }) {
  const label = item.unidadeProcessoLabel?.trim() || "—";
  if (!item.solicitacaoId) {
    return <span className="font-mono text-sm text-slate-200">{label}</span>;
  }
  return (
    <Link
      href={`/portal/solicitacoes/${item.solicitacaoId}`}
      className="font-mono text-sm font-semibold text-[var(--accent)] hover:underline"
      title="Abrir a solicitação que gerou este ID"
    >
      {label}
    </Link>
  );
}
