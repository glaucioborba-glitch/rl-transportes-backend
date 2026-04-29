"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PortalTable } from "@/components/portal/portal-table";
import { ApiError, fetchFaturamento } from "@/lib/api/portal-client";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/lib/toast";

export default function FaturaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [row, setRow] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    if (!id) return;
    void (async () => {
      try {
        setRow(await fetchFaturamento(id));
      } catch (e) {
        toast.error(e instanceof ApiError ? e.message : "Erro");
        router.push("/portal/financeiro");
      }
    })();
  }, [id, router]);

  if (!row) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-8">
        <Skeleton className="h-40 w-full" />
      </main>
    );
  }

  const itens = (row.itens as Record<string, unknown>[] | undefined) ?? [];
  const nfs = (row.nfsEmitidas as { id?: string; numeroNfe?: string; statusIpm?: string }[] | undefined) ?? [];
  const sols = (row.solicitacoesVinculadas as { solicitacao?: { id?: string; protocolo?: string } }[] | undefined) ?? [];

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-white">Fatura {String(row.periodo)}</h1>
          <p className="text-sm text-slate-400">
            Status boleto: {String(row.statusBoleto ?? "—")} · Total: R$ {String(row.valorTotal ?? "—")}
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/portal/financeiro">Voltar</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Itens</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <PortalTable
            columns={[
              { key: "d", header: "Descrição" },
              { key: "v", header: "Valor" },
            ]}
            rows={itens}
            getRowKey={(r) => String(r.id ?? Math.random())}
            renderCell={(r, key) => {
              if (key === "d") return String(r.descricao ?? "—");
              if (key === "v") return String(r.valor ?? "—");
              return null;
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Solicitações vinculadas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {sols.length === 0 ? (
            <p className="text-slate-500">Nenhuma.</p>
          ) : (
            sols.map((s) => (
              <div key={s.solicitacao?.id} className="flex justify-between text-sm">
                <span>{s.solicitacao?.protocolo}</span>
                <Button variant="link" className="h-auto p-0 text-[var(--accent)]" asChild>
                  <Link href={`/portal/solicitacoes/${s.solicitacao?.id}`}>Abrir</Link>
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>NFS-e associadas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {nfs.length === 0 ? (
            <p className="text-slate-500">Nenhuma emitida.</p>
          ) : (
            nfs.map((n) => (
              <div key={n.id} className="flex justify-between text-sm">
                <span>
                  {n.numeroNfe} · {n.statusIpm}
                </span>
                <Button variant="link" className="h-auto p-0" asChild>
                  <Link href={`/portal/financeiro/nfse/${n.id}`}>Ver</Link>
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </main>
  );
}
