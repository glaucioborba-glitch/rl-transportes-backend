import { ValidacaoDominio } from '@prisma/client';

/** Extrai domínio de e-mail (lowercase, sem espaços). */
export function extractEmailDomain(email: string): string | null {
  const e = email.trim().toLowerCase();
  const at = e.lastIndexOf('@');
  if (at < 1 || at >= e.length - 1) return null;
  return e.slice(at + 1);
}

/** Compara domínio informado vs. e-mail oficial da Receita (BrasilAPI). */
export function compareDominioCorporativo(
  emailInformado: string,
  emailReceita: string | null | undefined,
): ValidacaoDominio {
  const receita = emailReceita?.trim();
  if (!receita) return ValidacaoDominio.INDISPONIVEL;
  const dInformado = extractEmailDomain(emailInformado);
  const dReceita = extractEmailDomain(receita);
  if (!dReceita) return ValidacaoDominio.INDISPONIVEL;
  if (!dInformado) return ValidacaoDominio.DIVERGENTE;
  return dInformado === dReceita ? ValidacaoDominio.APROVADO : ValidacaoDominio.DIVERGENTE;
}
