"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RawStatusBadge } from "@/components/portal/status-badge";
import { FaturaArmazenagemLinks } from "@/components/portal/fatura-armazenagem-links";
import { faturaArmazenagemStatusLabel, faturaArmazenagemStatusVariant } from "@/lib/portal-status";
import { ApiError, fetchFaturaArmazenagem, fetchPortalDashboard, type FaturaArmazenagemPortal } from "@/lib/api/portal-client";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/lib/toast";
import { isLayoutPixPortal } from "@/lib/condicao-pagamento-portal";
import { formatBRL } from "@/lib/financeiro/format";

export default function FaturaArmazenagemDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [row, setRow] = useState<FaturaArmazenagemPortal | null>(null);
  const [layoutPix, setLayoutPix] = useState(false);

  useEffect(() => {
    if (!id) return;
    void (async () => {
      try {
        const [fat, dash] = await Promise.all([
          fetchFaturaArmazenagem(id),
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

  const st = String(row.statusPagamento ?? "");
  const iso = row.preFatura?.containerIso ?? "—";
  const dias = row.preFatura?.diasCobrados ?? "—";

  return (
    <main className="mx-auto w-[90%] space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-white">
            FAT · {iso}
          </h1>
          <p className="text-sm text-slate-400">
            {dias} diária(s) · {formatBRL(Number(row.valorTotal ?? 0))} ·{" "}
            {row.dataEmissao ? new Date(row.dataEmissao).toLocaleDateString("pt-BR") : "—"}
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
          <CardTitle>Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Pagamento</span>
            <RawStatusBadge label={faturaArmazenagemStatusLabel(st)} variant={faturaArmazenagemStatusVariant(st)} />
          </div>
          {row.numeroRps ? (
            <div className="flex justify-between">
              <span className="text-slate-500">RPS</span>
              <span className="text-white">
                {row.serieRps ? `${row.serieRps}/` : ""}
                {row.numeroRps}
              </span>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pagamento e documentos fiscais</CardTitle>
        </CardHeader>
        <CardContent>
          <FaturaArmazenagemLinks fatura={row} hideBoleto={layoutPix} />
        </CardContent>
      </Card>
    </main>
  );
}
