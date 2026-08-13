import { ApiError, staffFormData, staffJson } from "@/lib/api/staff-client";

export type ArquivoBancarioStatus = "PENDENTE" | "PROCESSANDO" | "CONCLUIDO" | "ERRO";

export type ArquivoBancarioRow = {
  id: string;
  tenantId: string;
  nomeArquivo: string;
  tipo: "REMESSA" | "RETORNO";
  status: ArquivoBancarioStatus;
  dataUpload: string;
  processadoEm: string | null;
  resumo: string | null;
  logProcessamento?: {
    resumo?: string;
    faturasBaixadas?: number;
    faturasNaoEncontradas?: number;
    faturasValorDivergente?: number;
    clientesDesbloqueados?: number;
  } | null;
};

export async function fetchCnabArquivos(limit = 50): Promise<ArquivoBancarioRow[]> {
  return staffJson<ArquivoBancarioRow[]>(`/financeiro/cnab/arquivos?limit=${limit}`);
}

export async function uploadCnabRetorno(file: File): Promise<ArquivoBancarioRow> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await staffFormData("/financeiro/cnab/upload", fd);
  if (!res.ok) {
    const err = await res.text();
    throw new ApiError(err || `Erro HTTP ${res.status}`, res.status);
  }
  return res.json() as Promise<ArquivoBancarioRow>;
}
