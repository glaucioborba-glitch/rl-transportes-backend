import type { AuditRow } from "@/components/ssma/audit-security-table";

/** Normaliza resposta de GET /auditoria ({ data: [...] }). */
export function mapAuditoriaPayload(d: unknown): AuditRow[] {
  if (!d || typeof d !== "object") return [];
  const o = d as { data?: unknown[] };
  const arr = o.data;
  if (!Array.isArray(arr)) return [];
  return arr.map((x) => {
    const r = x as Record<string, unknown>;
    return {
      id: String(r.id ?? ""),
      createdAt: String(r.createdAt ?? ""),
      tabela: String(r.tabela ?? ""),
      acao: String(r.acao ?? ""),
      usuario: r.usuario != null ? String(r.usuario) : null,
      registroId: r.registroId != null ? String(r.registroId) : null,
      dadosDepois: r.dadosDepois,
    };
  });
}

/** Mescla várias respostas GET /auditoria, deduplica por `id` e ordena por data desc. */
export function mergeAuditoriaPayloads(...payloads: unknown[]): AuditRow[] {
  const m = new Map<string, AuditRow>();
  for (const p of payloads) {
    for (const r of mapAuditoriaPayload(p)) {
      if (r.id) m.set(r.id, r);
    }
  }
  return Array.from(m.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
