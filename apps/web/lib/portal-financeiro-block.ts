/** Rotas de agendamento/nova solicitação bloqueadas por inadimplência financeira. */
export const PORTAL_AGENDAMENTO_BLOCKED_PATHS = [
  "/portal/solicitacoes/nova",
  "/portal/agendar",
  "/cliente/portal/patiamento",
] as const;

export function isPortalAgendamentoPath(pathname: string): boolean {
  return PORTAL_AGENDAMENTO_BLOCKED_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

export const PORTAL_BLOQUEIO_FINANCEIRO_TOAST =
  "Esta empresa possui pendências financeiras. O agendamento de retirada está suspenso.";

export const PORTAL_BLOQUEIO_FINANCEIRO_BANNER_PREFIX =
  "⚠️ Esta empresa possui pendências financeiras. O agendamento de retirada está suspenso.";

export const PORTAL_BLOQUEIO_FINANCEIRO_BANNER_LINK = "Clique aqui para ver suas faturas em aberto";

export const PORTAL_SCHEDULING_DISABLED_CLASS =
  "disabled:cursor-not-allowed disabled:bg-zinc-600 disabled:text-zinc-300 disabled:opacity-70 disabled:hover:bg-zinc-600";
