import { staffJson } from "@/lib/api/staff-client";

export type CadastroCapacidadeContainer = {
  id: string;
  codigo: string;
  nome: string;
  ativo: boolean;
};

export async function listCadastrosCapacidadesContainer() {
  return staffJson<{ items: CadastroCapacidadeContainer[]; total: number }>(
    "/v2/cadastros/capacidades-container",
  );
}
