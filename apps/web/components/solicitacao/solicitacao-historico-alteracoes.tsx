"use client";

import { useEffect, useState } from "react";
import { History } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  type AuditLogUiItem,
  formatAuditEntryLines,
  formatAuditTimestamp,
} from "@/lib/audit-log-format";

type Props = {
  solicitacaoId: string;
  load: (id: string) => Promise<{ items: AuditLogUiItem[] }>;
};

export function SolicitacaoHistoricoAlteracoes({ solicitacaoId, load }: Props) {
  const [items, setItems] = useState<AuditLogUiItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await load(solicitacaoId);
        if (!cancelled) setItems(res.items ?? []);
      } catch {
        if (!cancelled) setError("Não foi possível carregar o histórico de alterações.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [solicitacaoId, load]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Histórico de Alterações</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Histórico de Alterações</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-rose-300">{error}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5 text-[var(--accent)]" />
          Histórico de Alterações
        </CardTitle>
        <CardDescription>
          Trilha imutável de mudanças em placa, motorista, CPF, data e turno.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {items.length ? (
          <ul className="space-y-4">
            {items.map((item) => {
              const lines = formatAuditEntryLines(item);
              return (
                <li
                  key={item.id}
                  className="rounded-lg border border-white/10 bg-black/20 px-4 py-3 text-sm text-slate-300"
                >
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    {formatAuditTimestamp(item.criadoEm)}
                  </p>
                  <ul className="mt-2 space-y-1">
                    {lines.map((line, idx) => (
                      <li key={`${item.id}-${idx}`} className="text-slate-200">
                        {line}
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">Nenhuma alteração registrada nesta solicitação.</p>
        )}
      </CardContent>
    </Card>
  );
}
