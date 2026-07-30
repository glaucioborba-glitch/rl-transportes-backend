import { staffJson } from "@/lib/api/staff-client";

export type CadastroMotivoRejeicao = {
  id: string;
  codigo: string;
  descricao: string;
  tipo: string;
  exigeObservacao: boolean;
  notificaCliente: boolean;
  ativo: boolean;
};

function qs(tipo?: string) {
  if (!tipo || tipo === "todos") return "";
  return `?tipo=${encodeURIComponent(tipo)}`;
}

export async function listCadastrosMotivosRejeicao(tipo?: string) {
  return staffJson<{ items: CadastroMotivoRejeicao[]; total: number }>(
    `/v2/cadastros/motivos-rejeicao${qs(tipo)}`,
  );
}

export async function getCadastroMotivoRejeicao(id: string) {
  return staffJson<CadastroMotivoRejeicao>(
    `/v2/cadastros/motivos-rejeicao/${encodeURIComponent(id)}`,
  );
}

export async function createCadastroMotivoRejeicao(data: Omit<CadastroMotivoRejeicao, "id">) {
  return staffJson<CadastroMotivoRejeicao>("/v2/cadastros/motivos-rejeicao", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function updateCadastroMotivoRejeicao(
  id: string,
  data: Omit<CadastroMotivoRejeicao, "id">,
) {
  return staffJson<CadastroMotivoRejeicao>(
    `/v2/cadastros/motivos-rejeicao/${encodeURIComponent(id)}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    },
  );
}
