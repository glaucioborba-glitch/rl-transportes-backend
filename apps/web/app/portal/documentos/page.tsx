"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SectionTitle } from "@/components/portal/portal-primitives";
import { PortalTable } from "@/components/portal/portal-table";
import { RawStatusBadge } from "@/components/portal/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { boletoStatusVariant } from "@/lib/portal-status";
import {
  ApiError,
  fetchBoletosPaginated,
  fetchFaturamentoPaginated,
  fetchNfsePaginated,
} from "@/lib/api/portal-client";
import { toast } from "@/lib/toast";

export default function PortalDocumentosPage() {
  const [loading, setLoading] = useState(true);
  const [fats, setFats] = useState<Record<string, unknown>[]>([]);
  const [boletos, setBoletos] = useState<Record<string, unknown>[]>([]);
  const [nfs, setNfs] = useState<Record<string, unknown>[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [fat, bol, nf] = await Promise.all([
        fetchFaturamentoPaginated({ page: 1, limit: 50 }),
        fetchBoletosPaginated({ page: 1, limit: 100 }),
        fetchNfsePaginated({ page: 1, limit: 100 }),
      ]);
      setFats((fat as { items?: Record<string, unknown>[] }).items ?? []);
      setBoletos(bol.items ?? []);
      setNfs(nf.items ?? []);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Erro ao carregar documentos");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-8">
        <Skeleton className="h-40 w-full" />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl space-y-8 px-4 py-8">
      <SectionTitle
        title="Documentos"
        description="Links para abrir cada registro no portal (XML/PDF de NFS-e na tela de detalhe quando disponível)."
      />

      <Card>
        <CardHeader>
          <CardTitle>NFS-e</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <PortalTable
            columns={[
              { key: "num", header: "Número" },
              { key: "st", header: "Status IPM" },
              { key: "dl", header: "Acesso" },
            ]}
            rows={nfs}
            getRowKey={(r) => String(r.id)}
            renderCell={(r, key) => {
              if (key === "num") return String(r.numeroNfe ?? "—");
              if (key === "st") return String(r.statusIpm ?? "—");
              if (key === "dl")
                return (
                  <Button variant="link" className="h-auto p-0 text-[var(--accent)]" asChild>
                    <Link href={`/portal/financeiro/nfse/${String(r.id)}`}>Abrir / download XML</Link>
                  </Button>
                );
              return null;
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Boletos</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <PortalTable
            columns={[
              { key: "num", header: "Número" },
              { key: "valor", header: "Valor" },
              { key: "st", header: "Status" },
              { key: "dl", header: "Acesso" },
            ]}
            rows={boletos}
            getRowKey={(r) => String(r.id)}
            renderCell={(r, key) => {
              if (key === "num") return String(r.numeroBoleto ?? "—");
              if (key === "valor") return String(r.valorBoleto ?? "—");
              if (key === "st") {
                const st = String(r.statusPagamento ?? "");
                return <RawStatusBadge label={st} variant={boletoStatusVariant(st)} />;
              }
              if (key === "dl")
                return (
                  <Button variant="link" className="h-auto p-0 text-[var(--accent)]" asChild>
                    <Link href={`/portal/financeiro/boletos/${String(r.id)}`}>Abrir detalhe</Link>
                  </Button>
                );
              return null;
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Faturas</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <PortalTable
            columns={[
              { key: "p", header: "Período" },
              { key: "v", header: "Valor" },
              { key: "b", header: "Boleto" },
              { key: "dl", header: "Acesso" },
            ]}
            rows={fats}
            getRowKey={(r) => String(r.id)}
            renderCell={(r, key) => {
              if (key === "p") return String(r.periodo ?? "—");
              if (key === "v") return String(r.valorTotal ?? "—");
              if (key === "b") return String(r.statusBoleto ?? "—");
              if (key === "dl")
                return (
                  <Button variant="link" className="h-auto p-0 text-[var(--accent)]" asChild>
                    <Link href={`/portal/financeiro/faturas/${String(r.id)}`}>Abrir fatura</Link>
                  </Button>
                );
              return null;
            }}
          />
        </CardContent>
      </Card>
    </main>
  );
}
