"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Edit, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWidgetData, WidgetError } from "@/components/ui/widget-error";
import { fetchCadastrosTransportadoraAuditoria } from "@/lib/api/cadastros-transportadoras-client";
import { formatDateTime } from "@/lib/cadastros/formatters";

type Props = {
  params: { id: string };
};

function AuditSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="h-24 animate-pulse rounded-lg border border-border bg-card" />
      ))}
    </div>
  );
}

export default function AuditoriaTransportadoraPage({ params }: Props) {
  const router = useRouter();
  const { data: historico, loading, error, refetch } = useWidgetData(
    () => fetchCadastrosTransportadoraAuditoria(params.id),
    [params.id],
  );

  return (
    <div className="space-y-6">
      <div>
        <Button type="button" variant="ghost" size="sm" onClick={() => router.back()}>
          ← Voltar
        </Button>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Auditoria da Transportadora</h1>
            <p className="text-sm text-muted-foreground">Histórico completo de alterações</p>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/cadastros/pessoas/transportadoras/${params.id}`}>Ver cadastro</Link>
          </Button>
        </div>
      </div>

      {loading ? <AuditSkeleton /> : null}
      {!loading && error ? (
        <WidgetError title="Não foi possível carregar o histórico" onRetry={refetch} />
      ) : null}

      {!loading && !error && (!historico || historico.length === 0) ? (
        <p className="text-center text-sm text-muted-foreground">Nenhuma alteração registrada.</p>
      ) : null}

      {!loading && !error && historico && historico.length > 0 ? (
        <div className="space-y-4">
          {historico.map((entry) => (
            <div key={entry.id} className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--accent)]/10">
                  {entry.action === "CREATE" ? (
                    <Plus className="h-4 w-4 text-green-400" />
                  ) : entry.action === "UPDATE" ? (
                    <Edit className="h-4 w-4 text-blue-400" />
                  ) : entry.action === "DELETE" ? (
                    <Trash2 className="h-4 w-4 text-red-400" />
                  ) : (
                    <Edit className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium">
                      {entry.action === "CREATE" && "Transportadora cadastrada"}
                      {entry.action === "UPDATE" && "Dados atualizados"}
                      {entry.action === "DELETE" && "Transportadora inativada"}
                      {entry.action === "READ" && "Consulta registrada"}
                    </p>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatDateTime(entry.createdAt)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Por: {entry.userName}
                    {entry.userEmail ? ` (${entry.userEmail})` : ""}
                  </p>
                  {entry.changes.length > 0 ? (
                    <div className="mt-3 space-y-1">
                      {entry.changes.map((change, i) => (
                        <div
                          key={i}
                          className="flex flex-wrap items-center gap-2 rounded bg-muted/30 px-2 py-1 text-xs"
                        >
                          <span className="font-medium text-muted-foreground">{change.field}:</span>
                          <span className="text-red-400 line-through">{change.before || "—"}</span>
                          <span className="text-muted-foreground">→</span>
                          <span className="text-green-400">{change.after || "—"}</span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
