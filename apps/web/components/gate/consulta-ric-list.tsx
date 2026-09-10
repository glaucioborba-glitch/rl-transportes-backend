"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FileText, Loader2, Repeat, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  fetchConsultaRic,
  type ConsultaRicItem,
  type ConsultaRicLeg,
} from "@/lib/gate/operacao-api";
import { toast } from "@/lib/toast";
import { CessaoTitularidadeDialog } from "@/components/gate/cessao-titularidade-dialog";

function hojeIso() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function isoHaDias(dias: number) {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function fmtData(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function hrefRic(protocolo: string) {
  return `/operador/gate/controle-entrada-saida/${encodeURIComponent(protocolo)}?from=consulta-ric`;
}

function LegResumo({ titulo, leg }: { titulo: string; leg: ConsultaRicLeg | null }) {
  if (!leg) {
    return <p className="text-sm text-muted-foreground">{titulo}: em pátio</p>;
  }
  return (
    <div className="space-y-0.5 text-sm">
      <p className="font-medium">
        {titulo}: {leg.operacao} · {fmtData(leg.em)}
      </p>
      <p className="text-xs text-muted-foreground">
        {leg.motorista} · {leg.placaCavalo}
        {leg.placaCarreta && leg.placaCarreta !== "—" ? ` / ${leg.placaCarreta}` : ""}
        {leg.booking !== "—" ? ` · ${leg.booking}` : ""}
      </p>
    </div>
  );
}

export function ConsultaRicList() {
  const [q, setQ] = useState("");
  const [direcao, setDirecao] = useState<"TODAS" | "ENTRADA" | "SAIDA">("TODAS");
  const [status, setStatus] = useState<"TODOS" | "ABERTO" | "ENCERRADO">("TODOS");
  const [de, setDe] = useState(isoHaDias(9));
  const [ate, setAte] = useState(hojeIso());
  const [items, setItems] = useState<ConsultaRicItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [aberto, setAberto] = useState<string | null>(null);
  const [cessaoId, setCessaoId] = useState<string | null>(null);

  const periodoLabel = useMemo(() => {
    const a = de.split("-").reverse().join("/");
    const b = ate.split("-").reverse().join("/");
    return `${a} a ${b}`;
  }, [de, ate]);

  async function carregar() {
    setLoading(true);
    try {
      const res = await fetchConsultaRic({ q, direcao, de, ate, status });
      setItems(res.items ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao consultar RICs.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void carregar();
    // carga inicial: últimos 10 dias
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Consulta RIC</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          IDs emitidos no Gate — o mesmo número vale da entrada até a saída. Lista padrão: últimos 10
          dias ({periodoLabel}).
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-4">
        <label className="min-w-[12rem] flex-1 space-y-1 text-xs text-muted-foreground">
          Busca
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void carregar();
              }}
              placeholder="ID, ISO, cliente, booking, protocolo"
              className="pl-8"
            />
          </div>
        </label>
        <label className="space-y-1 text-xs text-muted-foreground">
          Operação
          <select
            value={direcao}
            onChange={(e) => setDirecao(e.target.value as typeof direcao)}
            className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground"
          >
            <option value="TODAS">Entrada e saída</option>
            <option value="ENTRADA">Só entrada</option>
            <option value="SAIDA">Só saída</option>
          </select>
        </label>
        <label className="space-y-1 text-xs text-muted-foreground">
          Situação do ID
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as typeof status)}
            className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground"
          >
            <option value="TODOS">Todas</option>
            <option value="ABERTO">Entrada (no pátio)</option>
            <option value="ENCERRADO">Saída (encerrado)</option>
          </select>
        </label>
        <label className="space-y-1 text-xs text-muted-foreground">
          De
          <Input type="date" value={de} onChange={(e) => setDe(e.target.value)} />
        </label>
        <label className="space-y-1 text-xs text-muted-foreground">
          Até
          <Input type="date" value={ate} onChange={(e) => setAte(e.target.value)} />
        </label>
        <Button type="button" onClick={() => void carregar()} disabled={loading}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Filtrar
        </Button>
      </div>

      {loading && items.length === 0 ? (
        <div className="flex min-h-[30vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : items.length === 0 ? (
        <p className="rounded-lg border border-border px-4 py-8 text-center text-sm text-muted-foreground">
          Nenhuma RIC neste período. Amplie as datas ou busque por ID / ISO / cliente.
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2">ID</th>
                <th className="px-3 py-2">Unidade</th>
                <th className="px-3 py-2">Cliente</th>
                <th className="px-3 py-2">Entrada</th>
                <th className="px-3 py-2">Saída</th>
                <th className="px-3 py-2">RIC</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => {
                const expandido = aberto === row.id;
                return (
                  <tr key={row.id} className="border-t border-border align-top">
                    <td className="px-3 py-3">
                      <button
                        type="button"
                        className="text-left font-semibold text-primary hover:underline"
                        onClick={() => setAberto(expandido ? null : row.id)}
                      >
                        {row.label}
                      </button>
                      <div className="mt-1">
                        {row.status === "ABERTO" ? (
                          <span className="inline-flex rounded-md border border-emerald-500/70 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-emerald-400">
                            Entrada
                          </span>
                        ) : (
                          <span className="inline-flex rounded-md border border-red-500/70 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-red-400">
                            Saída
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3 font-mono">{row.unidadeIso}</td>
                    <td className="px-3 py-3">
                      {row.solicitanteNome &&
                      row.titularNome &&
                      row.solicitanteNome !== row.titularNome ? (
                        <div>
                          <p>{row.titularNome}</p>
                          <p className="text-xs text-muted-foreground">
                            Solicitante: {row.solicitanteNome}
                          </p>
                        </div>
                      ) : (
                        row.clienteNome
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <LegResumo titulo="Entrada" leg={row.entrada} />
                      {expandido ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {row.entrada.processo !== "—" ? `Proc. ${row.entrada.processo} · ` : ""}
                          {row.entrada.navio !== "—" ? `Navio ${row.entrada.navio}` : ""}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-3 py-3">
                      <LegResumo titulo="Saída" leg={row.saida} />
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-col gap-2">
                        {row.entrada.protocolo ? (
                          <Button type="button" variant="outline" size="sm" asChild>
                            <Link href={hrefRic(row.entrada.protocolo)}>
                              <FileText className="mr-1 h-3.5 w-3.5" />
                              Entrada
                            </Link>
                          </Button>
                        ) : (
                          <Button type="button" variant="outline" size="sm" disabled>
                            <FileText className="mr-1 h-3.5 w-3.5" />
                            Entrada
                          </Button>
                        )}
                        {row.saida?.protocolo ? (
                          <Button type="button" variant="outline" size="sm" asChild>
                            <Link href={hrefRic(row.saida.protocolo)}>
                              <FileText className="mr-1 h-3.5 w-3.5" />
                              Saída
                            </Link>
                          </Button>
                        ) : (
                          <Button type="button" variant="outline" size="sm" disabled>
                            <FileText className="mr-1 h-3.5 w-3.5" />
                            Saída
                          </Button>
                        )}
                        <Button type="button" variant="outline" size="sm" onClick={() => setCessaoId(row.id)}>
                          <Repeat className="mr-1 h-3.5 w-3.5" />
                          Ceder
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
            {items.length} ID(s) no período.
          </p>
        </div>
      )}

      {cessaoId ? (
        <CessaoTitularidadeDialog
          unidadeProcessoId={cessaoId}
          open
          onOpenChange={(o) => {
            if (!o) setCessaoId(null);
          }}
          onConcluida={() => void carregar()}
        />
      ) : null}
    </div>
  );
}
