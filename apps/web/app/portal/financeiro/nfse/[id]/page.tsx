"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ApiError, fetchNfse } from "@/lib/api/portal-client";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/lib/toast";

export default function NfseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [n, setN] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    if (!id) return;
    void (async () => {
      try {
        setN(await fetchNfse(id));
      } catch (e) {
        toast.error(e instanceof ApiError ? e.message : "Erro");
        router.push("/portal/financeiro");
      }
    })();
  }, [id, router]);

  function dlXml() {
    if (!n?.xmlNfe) return;
    const blob = new Blob([String(n.xmlNfe)], { type: "application/xml" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `nfse-${String(n.numeroNfe ?? id)}.xml`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast.success("Download XML");
  }

  if (!n) {
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
          <h1 className="text-2xl font-bold text-white">NFS-e {String(n.numeroNfe)}</h1>
          <p className="text-sm text-slate-400">Status IPM: {String(n.statusIpm ?? "—")}</p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/portal/financeiro">Voltar</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Dados</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-slate-300">
          <p>Emissão: {n.createdAt ? new Date(String(n.createdAt)).toLocaleString("pt-BR") : "—"}</p>
          <p>Faturamento: {String(n.faturamentoId ?? "—")}</p>
          <div className="flex flex-wrap gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => dlXml()} disabled={!n.xmlNfe}>
              Download XML
            </Button>
            <Button type="button" variant="ghost" disabled>
              PDF (não disponível na API)
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>XML (trecho)</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="max-h-64 overflow-auto rounded-lg bg-black/50 p-3 text-xs text-slate-400">
            {String(n.xmlNfe ?? "").slice(0, 2000)}
            {(n.xmlNfe as string | undefined)?.length && (n.xmlNfe as string).length > 2000 ? "…" : ""}
          </pre>
        </CardContent>
      </Card>
    </main>
  );
}
