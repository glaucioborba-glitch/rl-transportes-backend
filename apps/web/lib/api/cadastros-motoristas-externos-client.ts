import { staffJson } from "@/lib/api/staff-client";
import type { CatalogoMotoristaExterno } from "@/lib/catalogo-motorista-externo";

export type CatalogoMotoristaExternoListResponse = {
  items: CatalogoMotoristaExterno[];
  total: number;
  page: number;
  pageSize: number;
};

export function listMotoristasExternos(params: {
  search?: string;
  status?: string;
  page?: number;
}) {
  const q = new URLSearchParams();
  if (params.search?.trim()) q.set("search", params.search.trim());
  if (params.status) q.set("status", params.status);
  if (params.page) q.set("page", String(params.page));
  const qs = q.toString();
  return staffJson<CatalogoMotoristaExternoListResponse>(
    `/v2/cadastros/motoristas-externos${qs ? `?${qs}` : ""}`,
  );
}

export function fetchStaffMotoristaExterno(cpf: string) {
  return staffJson<CatalogoMotoristaExterno | null>(
    `/v2/cadastros/motoristas-externos/cpf/${encodeURIComponent(cpf)}`,
  );
}

export function suspenderMotoristaExterno(id: string, dias: number, motivo: string) {
  return staffJson<CatalogoMotoristaExterno>(
    `/v2/cadastros/motoristas-externos/${encodeURIComponent(id)}/suspender`,
    {
      method: "PATCH",
      body: JSON.stringify({ dias, motivo }),
    },
  );
}

export function liberarMotoristaExterno(id: string) {
  return staffJson<CatalogoMotoristaExterno>(
    `/v2/cadastros/motoristas-externos/${encodeURIComponent(id)}/liberar`,
    { method: "PATCH" },
  );
}
