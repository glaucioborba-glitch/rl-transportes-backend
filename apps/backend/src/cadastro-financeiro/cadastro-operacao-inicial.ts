import { StatusCadastroCliente } from '@prisma/client';

/** Prazo padrão até a análise financeira (recebimento antes da coleta). */
export const PRAZO_CADASTRO_INICIAL = 'A_VISTA';
/** Forma vinculada ao prazo à vista. */
export const FORMA_CADASTRO_INICIAL = 'AVISTA_PIX';

/** Só cadastro rejeitado impede solicitações. Pendente opera à vista. */
export function cadastroPermiteSolicitacoes(
  status: StatusCadastroCliente | null | undefined,
): boolean {
  return status !== StatusCadastroCliente.REJEITADO;
}

export function prazoEfetivoCadastro(
  status: StatusCadastroCliente | null | undefined,
  prazo: string | null | undefined,
): string | null {
  if (status === StatusCadastroCliente.PENDENTE_ANALISE_FINANCEIRA) return PRAZO_CADASTRO_INICIAL;
  const t = prazo?.trim();
  return t || null;
}

export function formaEfetivaCadastro(
  status: StatusCadastroCliente | null | undefined,
  forma: string | null | undefined,
): string | null {
  if (status === StatusCadastroCliente.PENDENTE_ANALISE_FINANCEIRA) return FORMA_CADASTRO_INICIAL;
  const t = forma?.trim();
  return t || null;
}
