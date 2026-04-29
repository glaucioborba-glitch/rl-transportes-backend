import { ApiError, staffRequest } from "@/lib/api/staff-client";

export type BoletoStatusPagamento = "pendente" | "pago" | "vencido" | "cancelado";

/** PATCH /faturamento/boletos/:boletoId — contrato real do backend. */
export async function patchBoletoStatusJson(
  boletoId: string,
  statusPagamento: BoletoStatusPagamento,
): Promise<unknown> {
  const res = await staffRequest(`/faturamento/boletos/${boletoId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ statusPagamento }),
  });
  if (!res.ok) {
    throw new ApiError(await res.text(), res.status);
  }
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return {};
  }
}
