"use client";

import type { AuditTrailItem } from "@/lib/api/audit-trail-client";
import { CLASSIFICACAO_AUDITORIA } from "@/lib/auditoria/classificacao-auditoria";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { AuditoriaClassificacaoBadge } from "@/components/audit-trail/auditoria-classificacao-badge";

function formatWhen(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

function rotuloAtor(item: AuditTrailItem): { titulo: string; detalhe: string | null; portal: boolean } {
  if (item.fonte === "portal" || item.atorTipo === "cliente") {
    const empresa = item.empresaNome?.trim() || "Cliente";
    const operador = item.operadorNome?.trim() || item.usuarioNome;
    return { titulo: empresa, detalhe: operador, portal: true };
  }
  return {
    titulo: item.operadorNome?.trim() || item.usuarioNome,
    detalhe: null,
    portal: false,
  };
}

export function AuditTimeline({
  items,
  expandedId,
  onToggleDetails,
}: {
  items: AuditTrailItem[];
  expandedId: string | null;
  onToggleDetails: (id: string) => void;
}) {
  if (!items.length) {
    return (
      <p className="py-12 text-center text-sm text-zinc-500">
        Nenhum evento encontrado para os filtros atuais.
      </p>
    );
  }

  return (
    <ol className="relative space-y-0 border-l border-zinc-800 pl-6">
      {items.map((item) => {
        const visual = CLASSIFICACAO_AUDITORIA[item.classificacao] ?? CLASSIFICACAO_AUDITORIA.VERDE;
        const open = expandedId === item.id;
        const ator = rotuloAtor(item);
        const mudancas = item.mudancas ?? [];
        return (
          <li key={item.id} className="relative pb-8 last:pb-0">
            <span
              className={cn(
                "absolute -left-[1.65rem] flex h-8 w-8 items-center justify-center rounded-full border",
                visual.className,
              )}
              aria-hidden
            >
              <span className={cn("h-2.5 w-2.5 rounded-full", visual.dot)} />
            </span>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs font-medium text-zinc-500">[{formatWhen(item.criadoEm)}]</p>
                <AuditoriaClassificacaoBadge classificacao={item.classificacao} />
                {ator.portal ? (
                  <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-200">
                    Portal
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-sm leading-relaxed text-zinc-100">{item.descricaoNarrativa}</p>
              <p className="mt-1 text-xs text-zinc-400">
                <span className="font-medium text-zinc-200">{ator.titulo}</span>
                {ator.detalhe ? (
                  <>
                    <span className="text-zinc-600"> · </span>
                    <span>Operador: {ator.detalhe}</span>
                  </>
                ) : null}
              </p>
              <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-zinc-500">
                {item.containerIso ? (
                  <span className="rounded bg-zinc-800 px-2 py-0.5 font-mono text-zinc-300">
                    {item.containerIso}
                  </span>
                ) : null}
                {item.tabela ? <span>{item.tabela}</span> : <span>{item.categoria}</span>}
                <span>·</span>
                <span>{item.acao.replace(/_/g, " ")}</span>
                {item.fonte === "tecnica" ? (
                  <>
                    <span>·</span>
                    <span>registro técnico</span>
                  </>
                ) : null}
              </div>
              {mudancas.length ? (
                <div className="mt-3 overflow-hidden rounded-lg border border-zinc-800">
                  <p className="bg-zinc-950/80 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                    Como estava → como ficou
                  </p>
                  <ul className="divide-y divide-zinc-800/80">
                    {mudancas.map((m) => (
                      <li
                        key={`${item.id}-${m.campo}`}
                        className="flex flex-wrap items-center gap-2 px-3 py-1.5 text-xs"
                      >
                        <span className="min-w-[7rem] font-medium text-zinc-400">{m.label}</span>
                        <span className="text-red-400/90 line-through">{m.antes}</span>
                        <span className="text-zinc-600">→</span>
                        <span className="text-emerald-400">{m.depois}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mt-2 h-8 px-2 text-xs text-emerald-400 hover:text-emerald-300"
                onClick={() => onToggleDetails(item.id)}
              >
                {open ? "Ocultar detalhes técnicos" : "Ver detalhes técnicos"}
              </Button>
              {open ? (
                <pre className="mt-2 max-h-48 overflow-auto rounded-lg bg-black/50 p-3 text-[11px] text-zinc-400">
                  {JSON.stringify(
                    { antes: item.dadosAnteriores, depois: item.dadosNovos, ip: item.ipAddress },
                    null,
                    2,
                  )}
                </pre>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
