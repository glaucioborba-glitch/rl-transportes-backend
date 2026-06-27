"use client";

import type { AuditTrailItem, CategoriaAuditLog } from "@/lib/api/audit-trail-client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const CATEGORIA_ICON: Record<CategoriaAuditLog, { emoji: string; ring: string }> = {
  OPERACIONAL: { emoji: "🟢", ring: "border-emerald-500/30 bg-emerald-500/5" },
  FINANCEIRO: { emoji: "🔴", ring: "border-red-500/30 bg-red-500/5" },
  SEGURANCA: { emoji: "🟣", ring: "border-violet-500/30 bg-violet-500/5" },
  SISTEMA: { emoji: "🟡", ring: "border-amber-500/30 bg-amber-500/5" },
};

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
    return <p className="py-12 text-center text-sm text-zinc-500">Nenhum evento encontrado para os filtros atuais.</p>;
  }

  return (
    <ol className="relative space-y-0 border-l border-zinc-800 pl-6">
      {items.map((item) => {
        const visual = CATEGORIA_ICON[item.categoria] ?? CATEGORIA_ICON.SISTEMA;
        const open = expandedId === item.id;
        return (
          <li key={item.id} className="relative pb-8 last:pb-0">
            <span
              className={cn(
                "absolute -left-[1.65rem] flex h-8 w-8 items-center justify-center rounded-full border text-sm",
                visual.ring,
              )}
              aria-hidden
            >
              {visual.emoji}
            </span>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
              <p className="text-xs font-medium text-zinc-500">[{formatWhen(item.criadoEm)}]</p>
              <p className="mt-1 text-sm leading-relaxed text-zinc-100">{item.descricaoNarrativa}</p>
              <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-zinc-500">
                {item.containerIso ? (
                  <span className="rounded bg-zinc-800 px-2 py-0.5 font-mono text-zinc-300">{item.containerIso}</span>
                ) : null}
                <span>{item.categoria}</span>
                <span>·</span>
                <span>{item.acao.replace(/_/g, " ")}</span>
              </div>
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
                  {JSON.stringify({ antes: item.dadosAnteriores, depois: item.dadosNovos, ip: item.ipAddress }, null, 2)}
                </pre>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
