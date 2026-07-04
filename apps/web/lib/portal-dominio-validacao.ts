import type { ValidacaoDominioUi } from "@/lib/brasilapi/cnpj";

export function extractEmailDomain(email: string): string | null {
  const e = email.trim().toLowerCase();
  const at = e.lastIndexOf("@");
  if (at < 1 || at >= e.length - 1) return null;
  return e.slice(at + 1);
}

/** Indicador informativo — não bloqueia cadastro. */
export function compareDominioCorporativoUi(
  emailInformado: string,
  emailReceita: string | null | undefined,
): ValidacaoDominioUi {
  const receita = emailReceita?.trim();
  if (!receita) return "INDISPONIVEL";
  const dInformado = extractEmailDomain(emailInformado);
  const dReceita = extractEmailDomain(receita);
  if (!dReceita) return "INDISPONIVEL";
  if (!dInformado) return "DIVERGENTE";
  return dInformado === dReceita ? "APROVADO" : "DIVERGENTE";
}

export const DOMINIO_VALIDACAO_MESSAGES: Record<
  ValidacaoDominioUi,
  { icon: string; text: string; className: string }
> = {
  APROVADO: {
    icon: "🟢",
    text: "E-mail corporativo reconhecido",
    className: "text-emerald-400/90",
  },
  DIVERGENTE: {
    icon: "🟡",
    text: "E-mail diferente do cadastro na Receita Federal. O cadastro será analisado pelo financeiro.",
    className: "text-amber-400/90",
  },
  INDISPONIVEL: {
    icon: "⚪",
    text: "Não foi possível validar o domínio automaticamente.",
    className: "text-slate-400",
  },
};
