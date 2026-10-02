import { staffJson } from "@/lib/api/staff-client";

export type PatioFilaUrgencia = "PRIORITARIO" | "PREFERENCIAL" | "NORMAL";
export type PatioFilaTipo = "BAIXA" | "COLETA";

export type PatioFilaTarefa = {
  id: string;
  urgencia: PatioFilaUrgencia;
  tipo: PatioFilaTipo;
  status: string;
  protocolo: string;
  solicitacaoId: string;
  unidadeIso: string;
  processoNumero: number | null;
  processoLabel: string | null;
  clienteNome: string | null;
  posicaoConhecidaCodigo: string | null;
  posicaoConfirmadaCodigo: string | null;
  zonaConhecida: string | null;
  posicaoConhecida: number | null;
  zonaConfirmada: string | null;
  posicaoConfirmada: number | null;
  sugestaoZona: string | null;
  sugestaoMotivo: "cliente" | "navio" | "booking" | "processo" | null;
  sugestaoLabel: string;
  criadoEm: string;
};

export type PatioFilaPosicao = {
  codigo: string;
  zona: string;
  posicao: number;
  livre: boolean;
  ocupadaPor: string | null;
};

export async function enfileirarPatio(protocolo: string, urgencia: PatioFilaUrgencia) {
  return staffJson<{ items: PatioFilaTarefa[]; total: number }>("/v2/patio/fila", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ protocolo, urgencia }),
  });
}

export async function listarPatioFila() {
  return staffJson<{ items: PatioFilaTarefa[]; total: number }>("/v2/patio/fila");
}

export async function listarPatioFilaPosicoes() {
  return staffJson<{ origem: string; zonas?: string[]; items: PatioFilaPosicao[] }>(
    "/v2/patio/fila/posicoes",
  );
}

export async function confirmarPatioFila(id: string, posicaoCodigo?: string) {
  return staffJson<PatioFilaTarefa>(`/v2/patio/fila/${encodeURIComponent(id)}/confirmar`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ posicaoCodigo }),
  });
}

export async function remocaoPatioFila(origemCodigo: string, destinoCodigo: string) {
  return staffJson<{ origem: string; destino: string; unidadeIso: string }>(
    "/v2/patio/fila/remocao",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ origemCodigo, destinoCodigo }),
    },
  );
}
