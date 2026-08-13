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

export async function getCadastroPosicaoPatio(id: string) {
  return staffJson<CadastroPosicaoPatio>(`/v2/cadastros/posicoes-patio/${encodeURIComponent(id)}`);
}

export async function createCadastroPosicaoPatio(data: Omit<CadastroPosicaoPatio, "id" | "codigo"> & {
  zonaCodigo?: string;
  zonaNome?: string;
  zonaCor?: string;
}) {
  return staffJson<CadastroPosicaoPatio>("/v2/cadastros/posicoes-patio", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function updateCadastroPosicaoPatio(
  id: string,
  data: Omit<CadastroPosicaoPatio, "id" | "codigo"> & {
    zonaCodigo?: string;
    zonaNome?: string;
    zonaCor?: string;
  },
) {
  return staffJson<CadastroPosicaoPatio>(`/v2/cadastros/posicoes-patio/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}
