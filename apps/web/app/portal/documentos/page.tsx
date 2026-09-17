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
  fetchPortalDashboard,
  hrefPortalFat,
  type PortalFatEnvelope,
} from "@/lib/api/portal-client";
import { toast } from "@/lib/toast";
import { isLayoutPixPortal } from "@/lib/condicao-pagamento-portal";

export default function PortalDocumentosPage() {
  const [loading, setLoading] = useState(true);
  const [fats, setFats] = useState<PortalFatEnvelope[]>([]);
  const [boletos, setBoletos] = useState<Record<string, unknown>[]>([]);
  const [nfs, setNfs] = useState<Record<string, unknown>[]>([]);
  const [layoutPix, setLayoutPix] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [fat, bol, nf, dash] = await Promise.all([
        fetchFaturamentoPaginated({ page: 1, limit: 50 }),
        fetchBoletosPaginated({ page: 1, limit: 100 }),
        fetchNfsePaginated({ page: 1, limit: 100 }),
        fetchPortalDashboard({ recentPage: 1, recentLimit: 1 }).catch(() => null),
      ]);
      setFats(fat.items ?? []);
      setBoletos(bol.items ?? []);
      setNfs(nf.items ?? []);
      if (dash) {
        setLayoutPix(
          isLayoutPixPortal({
            statusCadastro: dash.statusCadastro ?? null,
            condicaoPagamento: dash.condicaoPagamento ?? null,
          }),
        );
      }
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
      <main className="mx-auto w-[90%] px-4 py-8">
        <Skeleton className="h-40 w-full" />
      </main>
    );
  }

  return (
    <main className="mx-auto w-[90%] space-y-8 px-4 py-8">
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

      {layoutPix ? null : (
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
      )}

      <Card>
        <CardHeader>
          <CardTitle>FAT</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <PortalTable
            columns={[
              { key: "p", header: "FAT" },
              { key: "r", header: "Referência" },
              ...(layoutPix ? [] : [{ key: "b", header: "Boleto" }]),
              { key: "dl", header: "Acesso" },
            ]}
            rows={fats}
            getRowKey={(r) => `${r.origem}-${r.id}`}
            renderCell={(r, key) => {
              if (key === "p") return r.numeroFat || String(r.periodo ?? "—");
              if (key === "r") return r.referencia || String(r.periodo ?? "—");
              if (key === "b") return String(r.statusBoleto ?? "—");
              if (key === "dl")
                return (
                  <Button variant="link" className="h-auto p-0 text-[var(--accent)]" asChild>
                    <Link href={hrefPortalFat(r)}>Abrir FAT</Link>
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
