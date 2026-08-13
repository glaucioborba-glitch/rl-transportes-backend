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
    case "EM_ANALISE":
      return "pendente";
    case "EM_EXECUCAO":
      return "aprovado";
    case "CANCELADO":
      return "rejeitado";
    case "CANCELADO_CLIENTE":
      return "rejeitado";
    default:
      return "neutral";
  }
}

export function solicitacaoStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    PENDENTE: "Pendente",
    APROVADO: "Aprovado",
    EM_ANALISE: "Em análise",
    EM_EXECUCAO: "Em execução",
    CANCELADO: "Cancelado",
    CANCELADO_CLIENTE: "Cancelado pelo cliente",
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

export function faturaArmazenagemStatusVariant(status: string): NonNullable<BadgeProps["variant"]> {
  const s = status?.toUpperCase() ?? "";
  if (s === "PAGO") return "aprovado";
  if (s === "AGUARDANDO_PAGAMENTO") return "pendente";
  if (s === "PROCESSANDO") return "neutral";
  if (s === "VENCIDO" || s === "CANCELADO") return "rejeitado";
  return "neutral";
}

export function faturaArmazenagemStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    PENDENTE: "Pendente emissão",
    PROCESSANDO: "Processando NFS-e/boleto",
    AGUARDANDO_PAGAMENTO: "Aguardando pagamento",
    PAGO: "Pago",
    VENCIDO: "Vencido",
    CANCELADO: "Cancelado",
  };
  return labels[status?.toUpperCase() ?? ""] ?? status;
}
