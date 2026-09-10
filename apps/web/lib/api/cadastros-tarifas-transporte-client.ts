import { staffJson } from "@/lib/api/staff-client";

export type CadastroTarifaLocalRef = {
  id: string;
  codigo: string;
  nome: string;
  tipo: string;
};

export type CadastroTarifaTransporte = {
  id: string;
  tabelaId: string;
  origemId: string;
  destinoId: string;
  trecho: string;
  localA: CadastroTarifaLocalRef;
  localB: CadastroTarifaLocalRef;
  statusCarga: "CHEIO" | "VAZIO" | string;
  tipoContainerCodigo: string;
  tipoContainerNome: string;
  retorno: boolean;
  valor: number;
  valorCobrado: number;
  valorPagoTerceiro: number | null;
  valorPagoTerceiroEfetivo?: number | null;
  observacao: string | null;
  ativo: boolean;
  criados?: number;
};

export type CadastroTarifaTransporteForm = {
  tabelaId: string;
  origemId: string;
  destinoId: string;
  statusCarga: "CHEIO" | "VAZIO";
  tipoContainerCodigos: string[];
  retorno: boolean;
  valor: number;
  valorPagoTerceiro?: number | null;
  observacao?: string | null;
  ativo: boolean;
};

export async function listCadastrosTarifasTransporte(tabelaId: string, search?: string) {
  const params = new URLSearchParams();
  params.set("tabelaId", tabelaId);
  if (search?.trim()) params.set("search", search.trim());
  return staffJson<{ items: CadastroTarifaTransporte[]; total: number }>(
    `/v2/cadastros/tarifas-transporte?${params.toString()}`,
  );
}

export async function getCadastroTarifaTransporte(id: string) {
  return staffJson<CadastroTarifaTransporte>(
    `/v2/cadastros/tarifas-transporte/${encodeURIComponent(id)}`,
  );
}

export async function createCadastroTarifaTransporte(data: CadastroTarifaTransporteForm) {
  return staffJson<CadastroTarifaTransporte>("/v2/cadastros/tarifas-transporte", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function updateCadastroTarifaTransporte(
  id: string,
  data: CadastroTarifaTransporteForm,
) {
  return staffJson<CadastroTarifaTransporte>(
    `/v2/cadastros/tarifas-transporte/${encodeURIComponent(id)}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    },
  );
}

export async function deleteCadastroTarifaTransporte(id: string) {
  return staffJson<void>(`/v2/cadastros/tarifas-transporte/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}
