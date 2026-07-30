import { staffJson, staffRequest } from "@/lib/api/staff-client";
import type { OperacaoState } from "./operacao-states";

export type OperacaoDto = {
  id: string;
  protocolo: string;
  state: OperacaoState;
  stateLabel: string;
  containerNumero: string;
  containerTipo: string;
  containerTamanho: string;
  containerSituacao: string;
  placa: string;
  motoristaNome: string;
  transportadoraNome: string;
  clienteNome: string;
  tipoOperacao: string;
  tatInicio: string | null;
  tatFim: string | null;
  vistoria?: {
    fotos: Array<{
      tipo: string;
      imagem: string;
      ocrResult?: string;
      ocrMatch?: boolean;
      ocrConfianca?: number;
      ocrProvider?: string;
    }>;
    avarias: Array<{ foto: string; descricao: string; localizacao: string }>;
  } | null;
  qrToken?: string | null;
};

export type AguardandoChegadaItem = {
  protocolo: string;
  containerNumero: string;
  containerTipo: string;
  placa: string;
  clienteNome: string;
};

export async function fetchOperacao(protocolo: string): Promise<OperacaoDto> {
  return staffJson<OperacaoDto>(`/v2/gate/operacoes/${encodeURIComponent(protocolo)}`);
}

export async function fetchAguardandoChegada(search?: string) {
  const q = search?.trim() ? `?search=${encodeURIComponent(search)}` : "";
  return staffJson<{ items: AguardandoChegadaItem[] }>(`/v2/gate/aguardando-chegada${q}`);
}

export async function fetchPortariaStats() {
  return staffJson<{
    aguardandoChegada: number;
    emVistoria: number;
    aguardandoGate: number;
    concluidasHoje: number;
  }>("/v2/gate/portaria/stats");
}

export async function postCheckin(protocolo: string) {
  return staffJson<OperacaoDto>(`/v2/gate/operacoes/${encodeURIComponent(protocolo)}/checkin`, {
    method: "POST",
  });
}

export async function postVistoria(
  protocolo: string,
  body: {
    fotos: Array<{
      tipo: string;
      imagem: string;
      ocrResult?: string;
      ocrMatch?: boolean;
      ocrConfianca?: number;
      ocrProvider?: string;
    }>;
    avarias: Array<{ foto: string; descricao: string; localizacao: string }>;
  },
) {
  return staffJson<OperacaoDto>(`/v2/gate/operacoes/${encodeURIComponent(protocolo)}/vistoria`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function processarOcr(imagem: string, tipo: "CONTAINER" | "PLACA", esperado?: string) {
  return staffJson<{
    sucesso: boolean;
    texto: string;
    textoBruto?: string;
    confianca: number;
    provider: string;
    ocrMatch: boolean;
    erro?: string;
  }>("/v2/ocr/processar", {
    method: "POST",
    body: JSON.stringify({ imagem, tipo, esperado }),
  });
}

export async function fetchReconfirmacoes() {
  return staffJson<{ items: OperacaoDto[] }>("/v2/gate/reconfirmacoes");
}

export async function fetchReconfirmacoesCount() {
  return staffJson<{ count: number }>("/v2/gate/reconfirmacoes/count");
}

export async function postReconfirmar(protocolo: string, checklist: Record<string, boolean>) {
  return staffJson<OperacaoDto>(`/v2/gate/operacoes/${encodeURIComponent(protocolo)}/reconfirmar`, {
    method: "POST",
    body: JSON.stringify({ checklist }),
  });
}

export async function postRejeitar(protocolo: string, motivo: string, etapa: string) {
  return staffJson<OperacaoDto>(`/v2/gate/operacoes/${encodeURIComponent(protocolo)}/rejeitar`, {
    method: "POST",
    body: JSON.stringify({ motivo, etapa }),
  });
}

export async function postAssinatura(protocolo: string, assinatura: string) {
  return staffJson<OperacaoDto>(`/v2/gate/operacoes/${encodeURIComponent(protocolo)}/assinatura`, {
    method: "POST",
    body: JSON.stringify({ assinatura }),
  });
}

export async function downloadRicPdf(protocolo: string): Promise<Blob> {
  const res = await staffRequest(`/v2/gate/operacoes/${encodeURIComponent(protocolo)}/ric-pdf`, {
    method: "POST",
    headers: { Accept: "application/pdf" },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `Erro HTTP ${res.status}`);
  }
  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("application/pdf")) {
    throw new Error(`Resposta inválida: esperado application/pdf, recebido ${contentType || "desconhecido"}`);
  }
  return res.blob();
}

export async function postLiberarOperacao(protocolo: string) {
  return staffJson<OperacaoDto>(
    `/v2/gate/operacoes/${encodeURIComponent(protocolo)}/liberar-operacao`,
    { method: "POST" },
  );
}

export async function postIniciarOperacao(protocolo: string, equipamentoId?: string) {
  return staffJson<OperacaoDto>(`/v2/gate/operacoes/${encodeURIComponent(protocolo)}/iniciar`, {
    method: "POST",
    body: JSON.stringify({ equipamentoId }),
  });
}

export async function postConcluirOperacao(protocolo: string) {
  return staffJson<OperacaoDto>(`/v2/gate/operacoes/${encodeURIComponent(protocolo)}/concluir`, {
    method: "POST",
  });
}

export async function fetchEquipamentoAtual() {
  try {
    return await staffJson<{ id: string; codigo: string; marca: string; modelo: string }>(
      "/v2/cadastros/operacional-vinculo/equipamento-atual",
    );
  } catch {
    return null;
  }
}
