"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RawStatusBadge } from "@/components/portal/status-badge";
import { boletoStatusVariant } from "@/lib/portal-status";
import { ApiError, fetchBoleto } from "@/lib/api/portal-client";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/lib/toast";

export default function BoletoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [b, setB] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    if (!id) return;
    void (async () => {
      try {
        setB(await fetchBoleto(id));
      } catch (e) {
        toast.error(e instanceof ApiError ? e.message : "Erro");
        router.push("/portal/financeiro");
      }
    })();
  }, [id, router]);

  function copyLinha() {
    const cod = String(b?.numeroBoleto ?? "");
    void navigator.clipboard.writeText(cod);
    toast.success("Número do boleto copiado");
  }

  if (!b) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-8">
        <Skeleton className="h-40 w-full" />
      </main>
    );
  }

  const st = String(b.statusPagamento ?? "");

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-white">Boleto {String(b.numeroBoleto)}</h1>
        <Button variant="outline" asChild>
          <Link href="/portal/financeiro">Voltar</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Resumo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">Valor</span>
            <span className="text-white">R$ {String(b.valorBoleto ?? "—")}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Vencimento</span>
            <span className="text-white">
              {b.dataVencimento ? new Date(String(b.dataVencimento)).toLocaleDateString("pt-BR") : "—"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Status</span>
            <RawStatusBadge label={st} variant={boletoStatusVariant(st)} />
          </div>
          <p className="text-xs text-slate-600">
            Schema atual não expõe linha digitável nem PDF; use o número para conciliação.
          </p>
          <Button type="button" variant="outline" onClick={() => copyLinha()}>
            Copiar número do boleto
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
