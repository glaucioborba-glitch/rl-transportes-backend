export type CatalogoMotoristaExterno = {
  id: string;
  cpf: string;
  nome: string;
  origem: string;
  suspenso: boolean;
  indefinido?: boolean;
  suspensoEm: string | null;
  suspensoAte: string | null;
  suspensaoDias: number | null;
  diasRestantes?: number | null;
  suspensaoMotivo: string | null;
  atualizadoEm: string;
};

/** Texto no portal do cliente — sem “blacklist” nem motivo. */
export const MSG_MOTORISTA_INDISPONIVEL_PORTAL =
  "Não foi possível incluir este motorista nesta solicitação. Informe outro CPF ou fale com o terminal.";

export function motoristaSuspensoMensagem(hit: CatalogoMotoristaExterno): string {
  if (hit.indefinido) {
    return "Motorista na Black List (prazo indefinido). Não pode realizar baixa/coleta.";
  }
  const restantes = hit.diasRestantes;
  const ate = hit.suspensoAte
    ? new Date(hit.suspensoAte).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })
    : "—";
  if (restantes === 0) {
    return `Motorista na Black List — encerra hoje (${ate}). Não pode realizar baixa/coleta.`;
  }
  if (typeof restantes === "number") {
    return `Motorista na Black List — restam ${restantes} dia(s), até ${ate}. Não pode realizar baixa/coleta.`;
  }
  return `Motorista na Black List até ${ate}. Não pode realizar baixa/coleta.`;
}

export function rotuloContagemBlacklist(hit: CatalogoMotoristaExterno): string {
  if (!hit.suspenso) return "";
  if (hit.indefinido) return "Indefinido";
  if (hit.diasRestantes === 0) return "Encerra hoje";
  if (typeof hit.diasRestantes === "number") return `Restam ${hit.diasRestantes} dia(s)`;
  return "Bloqueado";
}
