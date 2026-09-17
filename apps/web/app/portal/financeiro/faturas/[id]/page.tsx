"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PortalTable } from "@/components/portal/portal-table";
import { FaturaArmazenagemLinks } from "@/components/portal/fatura-armazenagem-links";
import { ApiError, fetchFaturamento, fetchPortalDashboard, type PortalFatEnvelope } from "@/lib/api/portal-client";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/lib/toast";
import { formatBRL } from "@/lib/financeiro/format";
import { isLayoutPixPortal } from "@/lib/condicao-pagamento-portal";

export default function FaturaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [row, setRow] = useState<PortalFatEnvelope | null>(null);
  const [layoutPix, setLayoutPix] = useState(false);

  useEffect(() => {
    if (!id) return;
    void (async () => {
      try {
        const [fat, dash] = await Promise.all([
          fetchFaturamento(id),
          fetchPortalDashboard({ recentPage: 1, recentLimit: 1 }).catch(() => null),
        ]);
        setRow(fat);
        if (dash) {
          setLayoutPix(
            isLayoutPixPortal({
              statusCadastro: dash.statusCadastro ?? null,
              condicaoPagamento: dash.condicaoPagamento ?? null,
            }),
          );
        }
      } catch (e) {
        toast.error(e instanceof ApiError ? e.message : "Erro");
        router.push("/portal/financeiro");
      }
    })();
  }, [id, router]);

  if (!row) {
    return (
      <main className="mx-auto w-[90%] px-4 py-8">
        <Skeleton className="h-40 w-full" />
      </main>
    );
  }

  const itens = row.itens ?? [];
  const nfs = row.nfsEmitidas ?? [];
  const boletos = row.boletos ?? [];
  const sols = row.solicitacoesVinculadas ?? [];
  const numero = row.numeroFat || `FAT · ${row.periodo}`;

  return (
    <main className="mx-auto w-[90%] space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-white">{numero}</h1>
          <p className="text-sm text-slate-400">
            {row.referencia || row.periodo} · NFS-e: {row.statusNfe || "—"}
            {layoutPix ? null : ` · Boleto: ${row.statusBoleto || "—"}`}
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/portal/financeiro">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Voltar
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Demonstrativo</CardTitle>
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
              if (key === "v") return formatBRL(Number(r.valor ?? 0));
              return null;
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>NFS-e</CardTitle>
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

      {layoutPix ? null : (
      <Card>
        <CardHeader>
          <CardTitle>Boleto</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {boletos.length === 0 ? (
            <p className="text-slate-500">Nenhum boleto vinculado.</p>
          ) : (
            boletos.map((b) => (
              <div key={b.id} className="flex justify-between text-sm">
                <span>
                  {b.numeroBoleto} · {b.statusPagamento} · {formatBRL(Number(b.valorBoleto ?? 0))}
                </span>
                <Button variant="link" className="h-auto p-0" asChild>
                  <Link href={`/portal/financeiro/boletos/${b.id}`}>Ver</Link>
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>
      )}

      {row.faturasArmazenagem?.some((f) => f.linkNfse || (!layoutPix && f.linkBoleto) || f.linkPix) ? (
        <Card>
          <CardHeader>
            <CardTitle>Documentos do pacote</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {row.faturasArmazenagem.map((f) =>
              f.linkNfse || (!layoutPix && f.linkBoleto) || f.linkPix ? (
                <FaturaArmazenagemLinks key={f.id} fatura={f} hideBoleto={layoutPix} />
              ) : null,
            )}
          </CardContent>
        </Card>
      ) : null}

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
    </main>
  );
}
