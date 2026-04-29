import type { BadgeProps } from "@/components/ui/badge";

export function solicitacaoStatusVariant(status: string): NonNullable<BadgeProps["variant"]> {
  switch (status) {
    case "PENDENTE":
      return "pendente";
    case "REJEITADO":
      return "rejeitado";
    case "APROVADO":
      return "aprovado";
    case "CONCLUIDO":
      return "concluido";
    default:
      return "neutral";
  }
}

export function solicitacaoStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    PENDENTE: "Pendente",
    APROVADO: "Aprovado",
    CONCLUIDO: "Concluído",
    REJEITADO: "Rejeitado",
  };
  return labels[status] ?? status;
}

export function boletoStatusVariant(status: string): NonNullable<BadgeProps["variant"]> {
  const s = status?.toLowerCase() ?? "";
  if (s === "pago") return "aprovado";
  if (s === "vencido") return "rejeitado";
  if (s === "pendente") return "pendente";
  return "neutral";
}
