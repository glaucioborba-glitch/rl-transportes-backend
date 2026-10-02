import { staffJson } from "@/lib/api/staff-client";
import type { ClassificacaoAuditoria } from "@/lib/auditoria/classificacao-auditoria";

export type CategoriaAuditLog = "OPERACIONAL" | "FINANCEIRO" | "SEGURANCA" | "SISTEMA";

export type AuditTrailItem = {
  id: string;
  criadoEm: string;
  categoria: CategoriaAuditLog;
  classificacao: ClassificacaoAuditoria;
  fonte: "narrativa" | "tecnica" | "portal";
  acao: string;
  tabela?: string | null;
  containerIso: string | null;
  descricaoNarrativa: string;
  usuarioId: string;
  usuarioNome: string;
  usuarioRole: string;
  atorTipo?: "cliente" | "staff" | "sistema";
  empresaNome?: string | null;
  operadorNome?: string;
  mudancas?: Array<{ campo: string; label: string; antes: string; depois: string }>;
  ipAddress: string | null;
  dadosAnteriores: unknown;
  dadosNovos: unknown;
};

export type AuditTrailQuery = {
  q?: string;
  categoria?: CategoriaAuditLog | "";
  classificacao?: ClassificacaoAuditoria | "";
  usuarioId?: string;
  acao?: string;
  containerIso?: string;
  dataInicio?: string;
  dataFim?: string;
  page?: number;
  limit?: number;
};

export type AuditTrailListResponse = {
  items: AuditTrailItem[];
  meta: { total: number; page: number; limit: number; totalPages: number };
  resumo?: { verde: number; amarelo: number; vermelho: number };
};

function qs(params: AuditTrailQuery): string {
  const p = new URLSearchParams();
  if (params.q) p.set("q", params.q);
  if (params.categoria) p.set("categoria", params.categoria);
  if (params.classificacao) p.set("classificacao", params.classificacao);
  if (params.usuarioId) p.set("usuarioId", params.usuarioId);
  if (params.acao) p.set("acao", params.acao);
  if (params.containerIso) p.set("containerIso", params.containerIso);
  if (params.dataInicio) p.set("dataInicio", params.dataInicio);
  if (params.dataFim) p.set("dataFim", params.dataFim);
  if (params.page) p.set("page", String(params.page));
  if (params.limit) p.set("limit", String(params.limit));
  const s = p.toString();
  return s ? `?${s}` : "";
}

export async function fetchAuditTrail(query: AuditTrailQuery = {}): Promise<AuditTrailListResponse> {
  return staffJson<AuditTrailListResponse>(`/audit-trail${qs(query)}`);
}

export async function fetchAuditTrailUsuarios(): Promise<{ usuarioId: string; usuarioNome: string }[]> {
  return staffJson<{ usuarioId: string; usuarioNome: string }[]>("/audit-trail/usuarios");
}

export async function fetchAuditTrailAcoes(): Promise<string[]> {
  return staffJson<string[]>("/audit-trail/acoes");
}

export function auditTrailExportUrl(query: AuditTrailQuery = {}): string {
  const base = process.env.NEXT_PUBLIC_API_URL ?? "";
  return `${base}/audit-trail/export${qs(query)}`;
}
