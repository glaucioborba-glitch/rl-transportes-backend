import { staffJson } from "@/lib/api/staff-client";

export type CadastroTurno = {
  id: string;
  codigo: string;
  nome: string;
  horaInicio: string;
  horaFim: string;
  capacidadeMaxima: number | null;
  diasSemana: string[];
  ativo: boolean;
};

export async function listCadastrosTurnos() {
  return staffJson<{ items: CadastroTurno[]; total: number }>("/v2/cadastros/turnos");
}

export async function getCadastroTurno(id: string) {
  return staffJson<CadastroTurno>(`/v2/cadastros/turnos/${encodeURIComponent(id)}`);
}

export async function createCadastroTurno(data: Omit<CadastroTurno, "id">) {
  return staffJson<CadastroTurno>("/v2/cadastros/turnos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function updateCadastroTurno(id: string, data: Omit<CadastroTurno, "id">) {
  return staffJson<CadastroTurno>(`/v2/cadastros/turnos/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}
