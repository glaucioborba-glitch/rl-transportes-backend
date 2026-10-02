export type AlertaDestinatariosFallback = {
  /** FINANCEIRO_NOTIFY_EMAIL, SMTP_FINANCEIRO_TO e, por último, o usuário SMTP. */
  candidatos: (string | undefined)[];
};

export type ResolvedAlertaDestinatarios = {
  /** 'tenant' = lista de Parâmetros → Notificações; 'env' = .env do servidor. */
  origem: 'tenant' | 'env' | 'none';
  destinatarios: string[];
  /** Pronto para o campo To: do nodemailer. */
  to: string;
};

function normalizar(lista: (string | undefined | null)[]): string[] {
  const vistos = new Set<string>();
  for (const item of lista) {
    const email = item?.trim().toLowerCase();
    if (email && email.includes('@')) vistos.add(email);
  }
  return [...vistos];
}

/**
 * Destinatários dos alertas do sistema: a lista do terminal manda; sem ela,
 * vale o que estiver no .env do servidor.
 */
export function resolveAlertaDestinatarios(
  emailsAlertaTenant: (string | undefined)[] | undefined,
  fallback: AlertaDestinatariosFallback,
): ResolvedAlertaDestinatarios {
  const doTenant = normalizar(emailsAlertaTenant ?? []);
  if (doTenant.length) {
    return { origem: 'tenant', destinatarios: doTenant, to: doTenant.join(', ') };
  }
  const doEnv = normalizar(fallback.candidatos);
  const primeiro = doEnv.slice(0, 1);
  return {
    origem: primeiro.length ? 'env' : 'none',
    destinatarios: primeiro,
    to: primeiro.join(', '),
  };
}
