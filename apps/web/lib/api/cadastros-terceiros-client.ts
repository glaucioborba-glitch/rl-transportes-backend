import { getApiBase } from "@/lib/api/corporate-auth-client";
import { staffJson } from "@/lib/api/staff-client";

export const CAPACIDADES_VEICULO_TERCEIRO = [
  { value: "PE_20", label: '20"' },
  { value: "PE_40", label: '40"' },
  { value: "AMBOS", label: "Ambos" },
] as const;

export type CapacidadeVeiculoTerceiro = (typeof CAPACIDADES_VEICULO_TERCEIRO)[number]["value"];

export const CNH_CATEGORIAS = ["B", "C", "D", "E", "AB", "AC", "AD", "AE"] as const;

export const TIPOS_DOCUMENTO_TERCEIRO = [
  { value: "CNH", label: "CNH Digital" },
  { value: "CRLV_CAVALO", label: "CRLV-e — cavalo" },
  { value: "CRLV_CARRETA", label: "CRLV-e — carreta" },
  { value: "CRLV_CARRETA_02", label: "CRLV-e — carreta 02 (rodotrem)" },
] as const;

export type TipoDocumentoTerceiro = (typeof TIPOS_DOCUMENTO_TERCEIRO)[number]["value"];

export type TerceiroSugestao = {
  nome?: string;
  cpf?: string;
  cnhCategoria?: string;
  cnhValidade?: string;
  placa?: string;
  donoNome?: string;
  renavam?: string;
  crlvValidade?: string;
};

export type CarretaTerceiro = {
  placa: string;
  capacidade?: CapacidadeVeiculoTerceiro | null;
  pinos?: string[];
  renavam?: string | null;
  validadeDocumento?: string | null;
};

export type CadastroTerceiroDocumento = {
  id: string;
  tipo: TipoDocumentoTerceiro;
  indice?: number | null;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  extraido?: TerceiroSugestao;
  sugestoes?: TerceiroSugestao;
  confianca?: number;
};

export type CadastroTerceiro = {
  id: string;
  motoristaNome: string;
  motoristaCpf: string;
  donoNome: string;
  pix: string;
  placaCavalo: string;
  renavamCavalo?: string | null;
  crlvValidadeCavalo?: string | null;
  placaCarreta: string | null;
  placaCarreta02?: string | null;
  placasCarretas?: string[];
  carretas?: CarretaTerceiro[];
  cnhCategoria?: string | null;
  cnhValidade?: string | null;
  whatsapp?: string | null;
  capacidade: CapacidadeVeiculoTerceiro;
  ativo: boolean;
  documentos?: CadastroTerceiroDocumento[];
};

export type CadastroTerceiroWrite = Omit<CadastroTerceiro, "id" | "documentos"> & {
  documentoIds?: string[];
};

export function labelCapacidadeTerceiro(capacidade: string) {
  return CAPACIDADES_VEICULO_TERCEIRO.find((c) => c.value === capacidade)?.label ?? capacidade;
}

export function pinosFromCapacidadeTerceiro(capacidade?: string | null): string[] {
  if (capacidade === "PE_20") return ["20"];
  if (capacidade === "PE_40") return ["40"];
  return ["20", "40"];
}

export function labelPinosTerceiro(carreta: Pick<CarretaTerceiro, "pinos" | "capacidade">) {
  const pinos = carreta.pinos?.length ? carreta.pinos : pinosFromCapacidadeTerceiro(carreta.capacidade);
  return pinos.map((p) => `${p}'`).join(" · ") || "—";
}

export function listCadastrosTerceiros(search?: string) {
  const qs = search?.trim() ? `?search=${encodeURIComponent(search.trim())}` : "";
  return staffJson<{ items: CadastroTerceiro[]; total: number }>(`/v2/cadastros/terceiros${qs}`);
}

export function getCadastroTerceiro(id: string) {
  return staffJson<CadastroTerceiro>(`/v2/cadastros/terceiros/${encodeURIComponent(id)}`);
}

export function createCadastroTerceiro(data: CadastroTerceiroWrite) {
  return staffJson<CadastroTerceiro>("/v2/cadastros/terceiros", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export function updateCadastroTerceiro(id: string, data: CadastroTerceiroWrite) {
  return staffJson<CadastroTerceiro>(`/v2/cadastros/terceiros/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export function docCarretaNoIndice(docs: CadastroTerceiroDocumento[], indice: number) {
  return docs.find((d) => {
    if (d.tipo !== "CRLV_CARRETA" && d.tipo !== "CRLV_CARRETA_02") return false;
    const i = d.indice ?? (d.tipo === "CRLV_CARRETA_02" ? 1 : 0);
    return i === indice;
  });
}

export function extrairDocumentoTerceiro(params: {
  arquivo: File;
  tipo: TipoDocumentoTerceiro;
  terceiroId?: string;
  indice?: number;
}) {
  const fd = new FormData();
  fd.append("arquivo", params.arquivo);
  fd.append("tipo", params.tipo);
  if (params.terceiroId) fd.append("terceiroId", params.terceiroId);
  if (params.indice != null) fd.append("indice", String(params.indice));
  return staffJson<CadastroTerceiroDocumento>("/v2/cadastros/terceiros/documentos", {
    method: "POST",
    body: fd,
  });
}

export function urlArquivoDocumentoTerceiro(docId: string) {
  return `${getApiBase()}/v2/cadastros/terceiros/documentos/${encodeURIComponent(docId)}/arquivo`;
}
