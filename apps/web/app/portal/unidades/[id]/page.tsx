"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ApiError, fetchSolicitacoesPaginated, type SolicitacaoRow } from "@/lib/api/portal-client";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/lib/toast";
import { formatDateTime } from "@/lib/portal-tracking";

/** Resolve unidade por id percorrendo amostra de solicitações (até API dedicada). */
export default function UnidadeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [solicitacao, setSolicitacao] = useState<SolicitacaoRow | null>(null);
  const [unidade, setUnidade] = useState<{ id: string; numeroIso: string; tipo: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const res = await fetchSolicitacoesPaginated({ page: 1, limit: 100, orderBy: "createdAt", order: "desc" });
        const items = (res as { items?: SolicitacaoRow[] }).items ?? [];
        for (const s of items) {
          const u = s.unidades?.find((x) => x.id === id);
          if (u) {
            if (!cancelled) {
              setSolicitacao(s);
              setUnidade(u);
            }
            setLoading(false);
            return;
          }
        }
        toast.error("Unidade não encontrada na amostra atual (aumente limite ou use link a partir da solicitação).");
        if (!cancelled) router.push("/portal/solicitacoes");
      } catch (e) {
        toast.error(e instanceof ApiError ? e.message : "Erro");
        if (!cancelled) router.push("/portal/solicitacoes");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, router]);

  if (loading || !solicitacao || !unidade) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-8">
        <Skeleton className="h-40 w-full" />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-white">{unidade.numeroIso}</h1>
          <p className="text-sm text-slate-400">
            Tipo {unidade.tipo} · Solicitação {solicitacao.protocolo}
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href={`/portal/solicitacoes/${solicitacao.id}`}>Voltar à solicitação</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Timeline operacional (contexto da solicitação)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-slate-300">
          <p>Portaria: {solicitacao.portaria ? formatDateTime(String(solicitacao.portaria.createdAt ?? "")) : "—"}</p>
          <p>Gate: {solicitacao.gate ? "registrado" : "—"}</p>
          <p>Pátio: {solicitacao.patio ? "registrado" : "—"}</p>
          <p>Saída: {solicitacao.saida ? "registrado" : "—"}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>JSON técnico (unidade + solicitação)</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="max-h-96 overflow-auto rounded-lg bg-black/50 p-3 text-xs text-slate-400">
            {JSON.stringify({ unidade, solicitacao }, null, 2)}
          </pre>
        </CardContent>
      </Card>
    </main>
  );
}
