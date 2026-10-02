import { staffJson } from "@/lib/api/staff-client";

export type CadastroPosicaoPatio = {
  id: string;
  zonaId: string;
  baiaId: string;
  codigo: string;
  zonaCodigo: string;
  baiaCodigo: string;
  zonaNome: string;
  zonaCor: string;
  posicao?: number;
  slotNumero: number;
  stackAltura: number;
  tipoAceito: string;
  tomadaReefer: boolean;
  capacidadePeso: number | null;
  status: string;
  restricoes: string | null;
  containerAtual: string | null;
  ativo: boolean;
};

export type CadastroPosicaoPatioPayload = {
  zonaId?: string;
  zonaCodigo?: string;
  zonaNome?: string;
  zonaCor?: string;
  posicao: number;
  status?: string;
  tipoAceito?: string;
  tomadaReefer?: boolean;
  ativo?: boolean;
};

export type CadastroPosicaoPatioZona = {
  id: string;
  codigo: string;
  nome: string;
  cor: string;
};

export async function listCadastrosPosicoesPatio() {
  return staffJson<{ items: CadastroPosicaoPatio[]; total: number }>("/v2/cadastros/posicoes-patio");
}

export async function listCadastrosPosicoesPatioZonas() {
  return staffJson<{ items: CadastroPosicaoPatioZona[]; total: number }>(
    "/v2/cadastros/posicoes-patio/zonas",
  );
}

export async function createCadastroZonaPatio(data: {
  codigo: string;
  nome?: string;
  quantidadePosicoes?: number;
}) {
  return staffJson<{ zona: CadastroPosicaoPatioZona; criadas: number }>(
    "/v2/cadastros/posicoes-patio/zonas",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    },
  );
}

export async function updateCadastroZonaPatio(
  id: string,
  data: { codigo: string; nome?: string; quantidadePosicoes?: number },
) {
  return staffJson<{ zona: CadastroPosicaoPatioZona; criadas: number }>(
    `/v2/cadastros/posicoes-patio/zonas/${encodeURIComponent(id)}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    },
  );
}

export async function deleteCadastroZonaPatio(id: string) {
  return staffJson<void>(`/v2/cadastros/posicoes-patio/zonas/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export async function getCadastroPosicaoPatio(id: string) {
  return staffJson<CadastroPosicaoPatio>(`/v2/cadastros/posicoes-patio/${encodeURIComponent(id)}`);
}

export async function ensureGradePadraoPosicoesPatio() {
  return staffJson<{ items: CadastroPosicaoPatio[]; total: number; criadas: number; arquivadas: number }>(
    "/v2/cadastros/posicoes-patio/grade-padrao",
    { method: "POST" },
  );
}

export async function createCadastroPosicaoPatio(data: CadastroPosicaoPatioPayload) {
  return staffJson<CadastroPosicaoPatio>("/v2/cadastros/posicoes-patio", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function updateCadastroPosicaoPatio(
  id: string,
  data: CadastroPosicaoPatioPayload,
) {
  return staffJson<CadastroPosicaoPatio>(`/v2/cadastros/posicoes-patio/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function deleteCadastroPosicaoPatio(id: string) {
  return staffJson<void>(`/v2/cadastros/posicoes-patio/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}
