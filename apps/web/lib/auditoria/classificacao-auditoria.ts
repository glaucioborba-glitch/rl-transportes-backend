export type ClassificacaoAuditoria = "VERDE" | "AMARELO" | "VERMELHO";

const ACAO_VERMELHA =
  /FATURA|BOLETO|NFSE|NFS_|PRE_FATURA|PARAMETROS|CESSAO|BLOQUEIO|EXCLUID|DELETE|CANCELAMENTO_TARDIO|SEGURANCA/i;
const ACAO_AMARELA =
  /ALTERAD|UPDATE|CORREC|CADASTRO_ALTERADO|SOLICITACAO_ALTERADA|CLIENTE_ALTERADO|REGISTRO_ALTERADO/i;
const TABELA_CRITICA = /fatur|boleto|nfs|parametro|pre_fatura|cessao|conta_corrente|contacorrente/i;
const PAYLOAD_SENHA =
  /gerentetoken|gerenteid|gerenteemail|supervisor|autorizacaogerente|exigiusenha|"password"/i;

export const CLASSIFICACAO_AUDITORIA = {
  VERDE: {
    titulo: "Normais",
    descricao: "Inclusões, solicitações e processos comuns do sistema.",
    className: "border-emerald-500/40 bg-emerald-500/10 text-emerald-200",
    dot: "bg-emerald-400",
  },
  AMARELO: {
    titulo: "Alterações",
    descricao: "Mudança em dado que já estava gravado.",
    className: "border-orange-500/40 bg-orange-500/10 text-orange-200",
    dot: "bg-orange-400",
  },
  VERMELHO: {
    titulo: "Críticas",
    descricao: "Exigem senha de gestor ou alteram fluxo, faturamento, parâmetros ou valores manuais.",
    className: "border-red-500/40 bg-red-500/10 text-red-200",
    dot: "bg-red-400",
  },
} as const;

function textoPayload(value: unknown): string {
  if (value == null) return "";
  try {
    return JSON.stringify(value).toLowerCase();
  } catch {
    return "";
  }
}

export function classificarAcaoAuditoria(input: {
  acao: string;
  categoria?: string | null;
  tabela?: string | null;
  dadosNovos?: unknown;
  dadosAnteriores?: unknown;
  dadosDepois?: unknown;
}): ClassificacaoAuditoria {
  const acao = String(input.acao ?? "").trim();
  if (acao === "SEGURANCA" || acao === "DELETE") {
    return "VERMELHO";
  }
  const payload = textoPayload(input.dadosNovos ?? input.dadosDepois) + textoPayload(input.dadosAnteriores);
  if (PAYLOAD_SENHA.test(payload)) return "VERMELHO";
  if (TABELA_CRITICA.test(String(input.tabela ?? "")) && acao !== "READ") {
    return "VERMELHO";
  }
  if (ACAO_VERMELHA.test(acao)) return "VERMELHO";
  if (ACAO_AMARELA.test(acao) || acao === "UPDATE") return "AMARELO";
  return "VERDE";
}

export function hrefAuditoriaGerencial(opts?: {
  classificacao?: ClassificacaoAuditoria;
  q?: string;
}): string {
  const p = new URLSearchParams();
  if (opts?.classificacao) p.set("classificacao", opts.classificacao);
  if (opts?.q) p.set("q", opts.q);
  const qs = p.toString();
  return qs ? `/admin/auditoria?${qs}` : "/admin/auditoria";
}
