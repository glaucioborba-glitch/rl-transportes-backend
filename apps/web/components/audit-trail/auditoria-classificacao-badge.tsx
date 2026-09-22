import { cn } from "@/lib/utils";
import {
  CLASSIFICACAO_AUDITORIA,
  classificarAcaoAuditoria,
  type ClassificacaoAuditoria,
} from "@/lib/auditoria/classificacao-auditoria";

export function AuditoriaClassificacaoBadge({
  classificacao,
  className,
}: {
  classificacao: ClassificacaoAuditoria;
  className?: string;
}) {
  const meta = CLASSIFICACAO_AUDITORIA[classificacao];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold",
        meta.className,
        className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} aria-hidden />
      {meta.titulo}
    </span>
  );
}

export function AuditoriaAcaoBadge({
  acao,
  tabela,
  dadosNovos,
  dadosAnteriores,
  className,
}: {
  acao: string;
  tabela?: string | null;
  dadosNovos?: unknown;
  dadosAnteriores?: unknown;
  className?: string;
}) {
  const mapped = acao === "CREATE" ? "INSERT" : acao;
  return (
    <AuditoriaClassificacaoBadge
      classificacao={classificarAcaoAuditoria({
        acao: mapped,
        tabela,
        dadosNovos,
        dadosAnteriores,
      })}
      className={className}
    />
  );
}
