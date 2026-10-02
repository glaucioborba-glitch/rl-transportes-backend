import { ApiError, nestErrorMessage, staffJson, staffRequest } from "@/lib/api/staff-client";
import type { MotivoLancamentoCc, TipoLancamentoCc } from "@/lib/financeiro/conta-corrente-display";

export type ContaCorrenteSituacao = "CREDOR" | "DEVEDOR" | "ZERADO";

export type ContaCorrenteCliente = {
  id: string;
  razaoSocial: string;
  nomeFantasia: string | null;
  cpfCnpj: string;
  saldo: number;
  lancamentos: number;
  comprovantesPendentes: number;
  situacao: ContaCorrenteSituacao;
  situacaoLabel: string;
};

export type ContaCorrenteLancamento = {
  id: string;
  tipo: TipoLancamentoCc;
  valor: number;
  valorSinal: number;
  motivo: MotivoLancamentoCc;
  motivoLabel: string;
  descricao: string;
  referencia: string | null;
  anexoNome: string | null;
  anexoMime: string | null;
  createdByNome: string | null;
  createdAt: string;
};

export type ContaCorrenteComprovantePendente = {
  id: string;
  valor: number;
  referenciaExterna: string | null;
  arquivoNome: string;
  mimeType: string;
  createdAt: string;
};

export type ContaCorrenteDetalhe = {
  cliente: ContaCorrenteCliente;
  comprovantesPendentes: ContaCorrenteComprovantePendente[];
  lancamentos: ContaCorrenteLancamento[];
};

export function listarContaCorrente(opts?: { search?: string; somenteComSaldo?: boolean }) {
  const q = new URLSearchParams();
  if (opts?.search?.trim()) q.set("search", opts.search.trim());
  if (opts?.somenteComSaldo) q.set("somenteComSaldo", "true");
  const qs = q.toString();
  return staffJson<{ items: ContaCorrenteCliente[] }>(
    `/v2/financeiro/conta-corrente${qs ? `?${qs}` : ""}`,
  );
}

export function contarPendenciasContaCorrente() {
  return staffJson<{ count: number }>("/v2/financeiro/conta-corrente/pendencias-count");
}

export function obterContaCorrente(clienteId: string) {
  return staffJson<ContaCorrenteDetalhe>(
    `/v2/financeiro/conta-corrente/${encodeURIComponent(clienteId)}`,
  );
}

export async function baixarComprovantePixCredito(clienteId: string, comprovanteId: string) {
  const res = await staffRequest(
    `/v2/financeiro/conta-corrente/${encodeURIComponent(clienteId)}/comprovantes/${encodeURIComponent(comprovanteId)}/arquivo`,
    { headers: { Accept: "*/*" } },
  );
  if (!res.ok) {
    const err = await res.text();
    throw new ApiError(nestErrorMessage(err, res.status), res.status);
  }
  const blob = await res.blob();
  const mime = blob.type || res.headers.get("content-type") || "application/octet-stream";
  return { blob, mime };
}

export function conferirComprovantePixCredito(
  clienteId: string,
  comprovanteId: string,
  body: { decisao: "APROVADO" | "NEGADO"; observacao?: string },
) {
  return staffJson<ContaCorrenteDetalhe>(
    `/v2/financeiro/conta-corrente/${encodeURIComponent(clienteId)}/comprovantes/${encodeURIComponent(comprovanteId)}/conferir`,
    { method: "POST", body: JSON.stringify(body) },
  );
}

export function lancarContaCorrente(
  clienteId: string,
  body: {
    tipo: TipoLancamentoCc;
    valor: number;
    motivo?: MotivoLancamentoCc;
    descricao: string;
    referencia?: string;
    anexo?: File | null;
  },
) {
  const form = new FormData();
  form.append("tipo", body.tipo);
  form.append("valor", String(body.valor));
  if (body.motivo) form.append("motivo", body.motivo);
  form.append("descricao", body.descricao);
  if (body.referencia) form.append("referencia", body.referencia);
  if (body.anexo) form.append("anexo", body.anexo);
  return staffJson<ContaCorrenteDetalhe>(
    `/v2/financeiro/conta-corrente/${encodeURIComponent(clienteId)}/lancamentos`,
    { method: "POST", body: form },
  );
}

export async function baixarAnexoLancamento(clienteId: string, lancamentoId: string) {
  const res = await staffRequest(
    `/v2/financeiro/conta-corrente/${encodeURIComponent(clienteId)}/lancamentos/${encodeURIComponent(lancamentoId)}/anexo`,
    { headers: { Accept: "*/*" } },
  );
  if (!res.ok) {
    const err = await res.text();
    throw new ApiError(nestErrorMessage(err, res.status), res.status);
  }
  const blob = await res.blob();
  const mime = blob.type || res.headers.get("content-type") || "application/octet-stream";
  return { blob, mime };
}

export function compensarContaCorrente(
  clienteId: string,
  body?: { descricao?: string; referencia?: string },
) {
  return staffJson<ContaCorrenteDetalhe>(
    `/v2/financeiro/conta-corrente/${encodeURIComponent(clienteId)}/compensar`,
    { method: "POST", body: JSON.stringify(body ?? {}) },
  );
}
