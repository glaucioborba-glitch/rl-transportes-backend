/** D-0 ou data passada — solicitação já entrou na janela de execução operacional. */
export function isJanelaExecucao(dataAgendamento: string | Date): boolean {
  const raw =
    typeof dataAgendamento === "string"
      ? dataAgendamento.includes("T")
        ? dataAgendamento
        : `${dataAgendamento}T00:00:00.000Z`
      : dataAgendamento.toISOString();

  const target = new Date(raw);
  if (Number.isNaN(target.getTime())) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);

  return target.getTime() <= today.getTime();
}

export function confirmarAcaoJanelaExecucao(
  dataAgendamento: string | Date,
  acao: "cancelar" | "alterar",
): boolean {
  const naJanela = isJanelaExecucao(dataAgendamento);
  if (naJanela) {
    return window.confirm(
      `A solicitação já está na janela de execução. Deseja realmente ${acao === "cancelar" ? "cancelar" : "alterar"}?`,
    );
  }
  if (acao === "cancelar") {
    return window.confirm("Deseja cancelar esta solicitação?");
  }
  return true;
}

export function isSolicitacaoTerminal(status: string): boolean {
  return ["CONCLUIDO", "REJEITADO", "CANCELADO", "CANCELADO_CLIENTE"].includes(status);
}
