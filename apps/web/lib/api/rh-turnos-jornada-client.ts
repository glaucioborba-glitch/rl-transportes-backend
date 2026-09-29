import { staffJson } from "@/lib/api/staff-client";

export type RegimeSabadoJornada = "SEM_SABADO" | "TODOS_SABADOS" | "ESPANHOL";

export type RhTurnoJornada = {
  id: string;
  codigo: string;
  nome: string;
  horaInicio: string;
  intervaloInicio: string | null;
  intervaloFim: string | null;
  horaFim: string;
  diasSemana: string[];
  jornadaSemanalHoras: number | null;
  regimeSabado: RegimeSabadoJornada | string;
  sabadoHoraInicio: string | null;
  sabadoIntervaloInicio: string | null;
  sabadoIntervaloFim: string | null;
  sabadoHoraFim: string | null;
  sabadoReferencia: string | null;
  observacoes: string | null;
  ativo: boolean;
  colaboradores: number;
  espanhol: { trabalha: string; folga: string } | null;
};

export type RhTurnoJornadaPayload = {
  codigo: string;
  nome: string;
  horaInicio: string;
  intervaloInicio?: string;
  intervaloFim?: string;
  horaFim: string;
  diasSemana: string[];
  jornadaSemanalHoras?: number;
  regimeSabado: RegimeSabadoJornada;
  sabadoHoraInicio?: string;
  sabadoIntervaloInicio?: string;
  sabadoIntervaloFim?: string;
  sabadoHoraFim?: string;
  sabadoReferencia?: string;
  observacoes?: string;
  ativo: boolean;
};

export async function listRhTurnosJornada(): Promise<{ items: RhTurnoJornada[]; total: number }> {
  return staffJson("/v2/rh/turnos-jornada");
}

export async function createRhTurnoJornada(data: RhTurnoJornadaPayload): Promise<RhTurnoJornada> {
  return staffJson("/v2/rh/turnos-jornada", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function updateRhTurnoJornada(
  id: string,
  data: RhTurnoJornadaPayload,
): Promise<RhTurnoJornada> {
  return staffJson(`/v2/rh/turnos-jornada/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function removeRhTurnoJornada(id: string): Promise<void> {
  await staffJson(`/v2/rh/turnos-jornada/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export function emptyRhTurnoJornada(): RhTurnoJornada {
  return {
    id: "",
    codigo: "",
    nome: "",
    horaInicio: "07:00",
    intervaloInicio: "12:00",
    intervaloFim: "13:00",
    horaFim: "16:00",
    diasSemana: ["SEG", "TER", "QUA", "QUI", "SEX"],
    jornadaSemanalHoras: 44,
    regimeSabado: "SEM_SABADO",
    sabadoHoraInicio: "07:00",
    sabadoIntervaloInicio: "12:00",
    sabadoIntervaloFim: "13:00",
    sabadoHoraFim: "17:00",
    sabadoReferencia: "",
    observacoes: "",
    ativo: true,
    colaboradores: 0,
    espanhol: null,
  };
}

export function templateEspanhol(): RhTurnoJornada {
  return {
    ...emptyRhTurnoJornada(),
    codigo: "OP_ESP",
    nome: "Operacional (sistema espanhol)",
    intervaloInicio: "11:00",
    intervaloFim: "12:00",
    regimeSabado: "ESPANHOL",
    observacoes: "Trabalha um sábado o dia todo e folga no sábado seguinte.",
  };
}
