export type AuditFieldDelta = {
  campo: string;
  label: string;
  antes: unknown;
  depois: unknown;
};

export type AuditLogUiItem = {
  id: string;
  criadoEm: string;
  acao: string;
  usuarioId: string;
  usuarioNome: string;
  usuarioRole: string;
  deltas: AuditFieldDelta[];
};

function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "string") return value;
  return String(value);
}

/** Rótulo humano do autor (espelha backend audit-log-solicitacao.util). */
export function formatAuditActorLabel(usuarioRole: string, usuarioNome: string): string {
  if (usuarioRole === "TRANSPORTADORA_TERCEIRA") {
    return `A transportadora ${usuarioNome}`;
  }
  if (usuarioRole === "ADMIN_CLIENTE" || usuarioRole === "CLIENTE") {
    return `O operador ${usuarioNome}`;
  }
  if (usuarioRole === "ADMIN" || usuarioRole === "GERENTE") {
    return `RL Transportes (${usuarioNome})`;
  }
  return usuarioNome;
}

export function formatAuditTimestamp(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  const time = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return `[${date} às ${time}]`;
}

export function formatAuditDeltaMessage(
  item: Pick<AuditLogUiItem, "usuarioRole" | "usuarioNome">,
  delta: AuditFieldDelta,
): string {
  const actor = formatAuditActorLabel(item.usuarioRole, item.usuarioNome);
  const antes = displayValue(delta.antes);
  const depois = displayValue(delta.depois);
  return `${actor} alterou o campo ${delta.label} de ${antes} para ${depois}.`;
}

export function formatAuditEntryLines(item: AuditLogUiItem): string[] {
  if (!item.deltas.length) {
    const actor = formatAuditActorLabel(item.usuarioRole, item.usuarioNome);
    return [`${actor} registrou uma alteração.`];
  }
  return item.deltas.map((d) => formatAuditDeltaMessage(item, d));
}
