import { staffJson } from "./staff-client";

export type TipoOpcaoPagamento = "FORMA" | "PRAZO";

export type CadastroOpcaoPagamento = {
  id: string;
  tipo: TipoOpcaoPagamento;
  label: string;
  value: string;
  ativo: boolean;
  ordem: number;
  dias: number | null;
  vencimentos: number[];
  formaVinculada: string | null;
};

export async function listCadastroOpcoesPagamento(tipo: TipoOpcaoPagamento) {
  return staffJson<CadastroOpcaoPagamento[]>(
    `/v2/cadastros/opcoes-pagamento?tipo=${encodeURIComponent(tipo)}`,
  );
}

export async function createCadastroOpcaoPagamento(data: {
  tipo: TipoOpcaoPagamento;
  label: string;
  value?: string;
  ativo?: boolean;
  dias?: number;
  vencimentos?: number[];
  formaVinculada?: string;
}) {
  return staffJson<CadastroOpcaoPagamento>("/v2/cadastros/opcoes-pagamento", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function updateCadastroOpcaoPagamento(
  id: string,
  data: {
    label?: string;
    ativo?: boolean;
    dias?: number;
    vencimentos?: number[];
    formaVinculada?: string;
  },
) {
  return staffJson<CadastroOpcaoPagamento>(`/v2/cadastros/opcoes-pagamento/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function deleteCadastroOpcaoPagamento(id: string) {
  return staffJson<void>(`/v2/cadastros/opcoes-pagamento/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}
