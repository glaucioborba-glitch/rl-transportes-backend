"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiCard, SectionTitle } from "@/components/portal/portal-primitives";
import { PortalTable } from "@/components/portal/portal-table";
import { RawStatusBadge } from "@/components/portal/status-badge";
import { boletoStatusVariant, faturaArmazenagemStatusLabel, faturaArmazenagemStatusVariant } from "@/lib/portal-status";
import {
  ApiError,
  fetchBoletosPaginated,
  fetchFaturamentoPaginated,
  fetchFaturasArmazenagemPaginated,
  fetchNfsePaginated,
  type FaturaArmazenagemPortal,
} from "@/lib/api/portal-client";
import { toast } from "@/lib/toast";
import { Skeleton } from "@/components/ui/skeleton";

export default function FinanceiroPage() {
  const [loading, setLoading] = useState(true);
  const [fats, setFats] = useState<Record<string, unknown>[]>([]);
  const [boletos, setBoletos] = useState<Record<string, unknown>[]>([]);
  const [nfs, setNfs] = useState<Record<string, unknown>[]>([]);
  const [armazenagem, setArmazenagem] = useState<FaturaArmazenagemPortal[]>([]);
  const [vencidos, setVencidos] = useState(0);
  const [pendenteVal, setPendenteVal] = useState(0);
  const [faturamentoLista, setFaturamentoLista] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [fat, bol, nf, arm] = await Promise.all([
        fetchFaturamentoPaginated({ page: 1, limit: 20 }),
        fetchBoletosPaginated({ page: 1, limit: 100 }),
        fetchNfsePaginated({ page: 1, limit: 50 }),
        fetchFaturasArmazenagemPaginated({ page: 1, limit: 50 }),
      ]);
      const fatItems = (fat as { items?: Record<string, unknown>[] }).items ?? [];
      setFats(fatItems);
      setBoletos(bol.items ?? []);
      setNfs(nf.items ?? []);
      setArmazenagem(arm.items ?? []);
      setFaturamentoLista(fatItems.reduce((a, r) => a + Number(r.valorTotal ?? 0), 0));

      const now = Date.now();
      let v = 0;
      let pend = 0;
      for (const b of bol.items ?? []) {
        const st = String(b.statusPagamento ?? "").toLowerCase();
        const ven = b.dataVencimento ? new Date(String(b.dataVencimento)).getTime() : 0;
        if (st === "pendente" && ven < now) v++;
        if (st === "pendente" || st === "vencido") {
          pend += Number(b.valorBoleto ?? 0);
        }
      }
      setVencidos(v);
      setPendenteVal(pend);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Erro ao carregar financeiro");
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

  const inad = boletos.length ? Math.round((vencidos / boletos.length) * 100) : 0;

  return (
    <main className="mx-auto max-w-7xl space-y-8 px-4 py-8">
      <SectionTitle
        title="Financeiro"
        description="Faturamento mensal, armazenagem Gate-Out (NFS-e + boleto/PIX), boletos e NFS-e."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard title="Inadimplência (proxy)" value={`${inad}%`} hint="Boletos pendentes vencidos / total listado" />
        <KpiCard title="Valor pendente (R$)" value={pendenteVal.toFixed(2)} hint="Soma boletos pendentes + vencidos" />
        <KpiCard
          title="Armazenagem aguardando pagamento"
          value={armazenagem.filter((r) => r.statusPagamento === "AGUARDANDO_PAGAMENTO").length}
          hint="Faturas Gate-Out com boleto/NFS-e emitidos"
        />
        <KpiCard
          title="Soma faturas (página)"
          value={`R$ ${faturamentoLista.toFixed(2)}`}
          hint="Total dos faturamentos retornados nesta página"
        />
        <KpiCard title="Boletos vencidos" value={vencidos} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Armazenagem (Gate-Out)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <PortalTable
            columns={[
              { key: "iso", header: "Contêiner" },
              { key: "dias", header: "Diárias" },
              { key: "valor", header: "Valor" },
              { key: "st", header: "Status" },
              { key: "docs", header: "Documentos" },
              { key: "act", header: "" },
            ]}
            rows={armazenagem}
            getRowKey={(r) => String(r.id)}
            renderCell={(r, key) => {
              if (key === "iso") return String(r.preFatura?.containerIso ?? "—");
              if (key === "dias") return String(r.preFatura?.diasCobrados ?? "—");
              if (key === "valor") return `R$ ${Number(r.valorTotal ?? 0).toFixed(2)}`;
              if (key === "st") {
                const st = String(r.statusPagamento ?? "");
                return (
                  <RawStatusBadge
                    label={faturaArmazenagemStatusLabel(st)}
                    variant={faturaArmazenagemStatusVariant(st)}
                  />
                );
              }
              if (key === "docs") {
                const hasDocs = !!(r.linkNfse || r.linkBoleto || r.linkPix);
                return hasDocs ? "Disponível" : "Processando";
              }
              if (key === "act")
                return (
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={`/portal/financeiro/armazenagem/${String(r.id)}`}>Abrir</Link>
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
              { key: "periodo", header: "Período" },
              { key: "valor", header: "Valor" },
              { key: "boleto", header: "Boleto" },
              { key: "act", header: "" },
            ]}
            rows={fats}
            getRowKey={(r) => String(r.id)}
            renderCell={(r, key) => {
              if (key === "periodo") return String(r.periodo ?? "—");
              if (key === "valor") return String(r.valorTotal ?? "—");
              if (key === "boleto") return String(r.statusBoleto ?? "—");
              if (key === "act")
                return (
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={`/portal/financeiro/faturas/${String(r.id)}`}>Abrir</Link>
                  </Button>
                );
              return null;
            }}
          />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Boletos</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <PortalTable
              columns={[
                { key: "num", header: "Número" },
                { key: "valor", header: "Valor" },
                { key: "ven", header: "Vencimento" },
                { key: "st", header: "Status" },
                { key: "act", header: "" },
              ]}
              rows={boletos}
              getRowKey={(r) => String(r.id)}
              renderCell={(r, key) => {
                if (key === "num") return String(r.numeroBoleto ?? "—");
                if (key === "valor") return String(r.valorBoleto ?? "—");
                if (key === "ven")
                  return r.dataVencimento ? new Date(String(r.dataVencimento)).toLocaleDateString("pt-BR") : "—";
                if (key === "st") {
                  const st = String(r.statusPagamento ?? "");
                  return <RawStatusBadge label={st} variant={boletoStatusVariant(st)} />;
                }
                if (key === "act")
                  return (
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/portal/financeiro/boletos/${String(r.id)}`}>Abrir</Link>
                    </Button>
                  );
                return null;
              }}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>NFS-e</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <PortalTable
              columns={[
                { key: "num", header: "Número" },
                { key: "st", header: "Status IPM" },
                { key: "em", header: "Emissão" },
                { key: "act", header: "" },
              ]}
              rows={nfs}
              getRowKey={(r) => String(r.id)}
              renderCell={(r, key) => {
                if (key === "num") return String(r.numeroNfe ?? "—");
                if (key === "st") return String(r.statusIpm ?? "—");
                if (key === "em")
                  return r.createdAt ? new Date(String(r.createdAt)).toLocaleString("pt-BR") : "—";
                if (key === "act")
                  return (
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/portal/financeiro/nfse/${String(r.id)}`}>Abrir</Link>
                    </Button>
                  );
                return null;
              }}
            />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
