import { staffJson } from "@/lib/api/staff-client";

export type CadastrosTipoContainer = {
  id: string;
  codigo: string;
  nome: string;
  tamanhos: string[];
  tomadaReefer: boolean;
  ativo: boolean;
};

export type CadastrosTipoContainerListResponse = {
  items: CadastrosTipoContainer[];
  total: number;
};

function qs(params: Record<string, string | undefined>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) p.set(k, v);
  }
  const s = p.toString();
  return s ? `?${s}` : "";
}

export async function listCadastrosTiposContainer(
  search?: string,
): Promise<CadastrosTipoContainerListResponse> {
  return staffJson(`/v2/cadastros/tipos-container${qs({ search })}`);
}

export async function getCadastrosTipoContainer(id: string): Promise<CadastrosTipoContainer> {
  return staffJson(`/v2/cadastros/tipos-container/${encodeURIComponent(id)}`);
}

export async function createCadastrosTipoContainer(
  data: Omit<CadastrosTipoContainer, "id">,
): Promise<CadastrosTipoContainer> {
  return staffJson("/v2/cadastros/tipos-container", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function updateCadastrosTipoContainer(
  id: string,
  data: Omit<CadastrosTipoContainer, "id">,
): Promise<CadastrosTipoContainer> {
  return staffJson(`/v2/cadastros/tipos-container/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}
