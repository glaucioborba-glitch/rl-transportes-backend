import { staffJson } from "@/lib/api/staff-client";
import type { MotivoLancamentoCc, TipoLancamentoCc } from "@/lib/financeiro/conta-corrente-display";

export type ContaCorrenteSituacao = "CREDOR" | "DEVEDOR" | "ZERADO";

export type ContaCorrenteCliente = {
  id: string;
  razaoSocial: string;
  nomeFantasia: string | null;
  cpfCnpj: string;
  saldo: number;
  lancamentos: number;
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
  createdByNome: string | null;
  createdAt: string;
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

export function obterContaCorrente(clienteId: string) {
  return staffJson<{ cliente: ContaCorrenteCliente; lancamentos: ContaCorrenteLancamento[] }>(
    `/v2/financeiro/conta-corrente/${encodeURIComponent(clienteId)}`,
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
  },
) {
  return staffJson<{ cliente: ContaCorrenteCliente; lancamentos: ContaCorrenteLancamento[] }>(
    `/v2/financeiro/conta-corrente/${encodeURIComponent(clienteId)}/lancamentos`,
    { method: "POST", body: JSON.stringify(body) },
  );
}

export function compensarContaCorrente(
  clienteId: string,
  body?: { descricao?: string; referencia?: string },
) {
  return staffJson<{ cliente: ContaCorrenteCliente; lancamentos: ContaCorrenteLancamento[] }>(
    `/v2/financeiro/conta-corrente/${encodeURIComponent(clienteId)}/compensar`,
    { method: "POST", body: JSON.stringify(body ?? {}) },
  );
}
