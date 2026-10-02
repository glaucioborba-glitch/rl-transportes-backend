"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FileText, Loader2, Repeat, Search, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  fetchConsultaRic,
  type ConsultaRicItem,
  type ConsultaRicLeg,
} from "@/lib/gate/operacao-api";
import { toast } from "@/lib/toast";
import { CessaoTitularidadeDialog } from "@/components/gate/cessao-titularidade-dialog";
import { ServicosIdCard } from "@/components/gate/servicos-id-card";
import { TomadaGateCard } from "@/components/gate/tomada-gate-card";
import { formatTipoTamanhoContainerLabel } from "@/lib/cadastros/tipo-container-tamanhos";
import { formatIsoDisplay } from "@/lib/container-display";
import { formatBRL } from "@/lib/financeiro/format";

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
  return d.toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  });
}

function hrefRic(protocolo: string) {
  return `/operador/gate/controle-entrada-saida/${encodeURIComponent(protocolo)}?from=consulta-ric`;
}

function rotuloSituacaoContainer(situacao?: string | null): string | null {
  const v = String(situacao ?? "").trim().toUpperCase();
  if (v === "CHEIO") return "Cheio";
  if (v === "VAZIO") return "Vazio";
  return situacao?.trim() || null;
}

function rotuloTipoTamanhoSituacao(row: ConsultaRicItem): string | null {
  const tipoTam = formatTipoTamanhoContainerLabel(row.tipoContainer, row.tamanhoContainer);
  const sit = rotuloSituacaoContainer(row.situacao);
  if (tipoTam && sit) return `${tipoTam} · ${sit}`;
  return tipoTam || sit;
}

function Campo({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 space-y-1 text-xs text-muted-foreground">
      {label}
      <div className="text-sm text-foreground">{children}</div>
    </div>
  );
}

function LegResumo({ titulo, leg }: { titulo: string; leg: ConsultaRicLeg | null }) {
  if (!leg) {
    return <Campo label={titulo}><span className="text-muted-foreground">em pátio</span></Campo>;
  }
  return (
    <Campo label={titulo}>
      <p className="font-medium">
        {leg.operacao} · {fmtData(leg.em)}
      </p>
      <p className="text-xs text-muted-foreground">
        {leg.motorista} · {leg.placaCavalo}
        {leg.placaCarreta && leg.placaCarreta !== "—" ? ` / ${leg.placaCarreta}` : ""}
        {leg.booking !== "—" ? ` · ${leg.booking}` : ""}
      </p>
    </Campo>
  );
}

function RicAcoes({ row, onCeder }: { row: ConsultaRicItem; onCeder: () => void }) {
  return (
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
      <Button type="button" variant="outline" size="sm" onClick={onCeder}>
        <Repeat className="mr-1 h-3.5 w-3.5" />
        Ceder
      </Button>
    </div>
  );
}

export function ConsultaRicList() {
  const searchParams = useSearchParams();
  const qInicial = searchParams.get("q")?.trim() ?? "";
  const [q, setQ] = useState(qInicial);
  const [direcao, setDirecao] = useState<"TODAS" | "ENTRADA" | "SAIDA">("TODAS");
  const [status, setStatus] = useState<"TODOS" | "ABERTO" | "ENCERRADO">("TODOS");
  const [de, setDe] = useState(qInicial ? isoHaDias(730) : isoHaDias(9));
  const [ate, setAte] = useState(hojeIso());
  const [items, setItems] = useState<ConsultaRicItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [aberto, setAberto] = useState<string | null>(null);
  const [cessaoId, setCessaoId] = useState<string | null>(null);
  const [servicosTick, setServicosTick] = useState(0);

  const periodoLabel = useMemo(() => {
    const a = de.split("-").reverse().join("/");
    const b = ate.split("-").reverse().join("/");
    return `${a} a ${b}`;
  }, [de, ate]);

  async function carregar(opts?: { silencioso?: boolean }) {
    if (!opts?.silencioso) setLoading(true);
    try {
      const res = await fetchConsultaRic({ q, direcao, de, ate, status });
      setItems(res.items ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao consultar RICs.");
    } finally {
      if (!opts?.silencioso) setLoading(false);
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
          IDs emitidos no Gate — o mesmo número vale da entrada até a saída. Clique no ID ou em
          Serviços para lançar no pátio. Lista padrão: últimos 10 dias ({periodoLabel}).
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
        <div className="space-y-3">
          {items.map((row) => {
            const expandido = aberto === row.id;
            const unidadeDetalhe = rotuloTipoTamanhoSituacao(row);
            return (
              <div key={row.id} className="rounded-lg border border-border bg-card p-4">
                <div className="flex flex-wrap items-start gap-4">
                  <div className="min-w-[11rem]">
                    <Campo label="ID">
                      <button
                        type="button"
                        className="text-left font-semibold text-primary hover:underline"
                        onClick={() => setAberto(expandido ? null : row.id)}
                      >
                        {row.label}
                      </button>
                      <div className="mt-1.5 flex flex-col items-start gap-1.5">
                        {row.status === "ABERTO" ? (
                          <span className="inline-flex rounded-md border border-emerald-500/70 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-emerald-400">
                            Entrada
                          </span>
                        ) : (
                          <span className="inline-flex rounded-md border border-red-500/70 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-red-400">
                            Saída
                          </span>
                        )}
                        {row.tomadaConectada ? (
                          <span className="inline-flex whitespace-nowrap rounded-md border border-amber-500/70 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-amber-400">
                            Conectado a tomada
                          </span>
                        ) : null}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setAberto(expandido ? null : row.id)}
                        >
                          <Wrench className="mr-1 h-3.5 w-3.5" />
                          {expandido ? "Fechar" : "Serviços"}
                        </Button>
                      </div>
                    </Campo>
                  </div>
                  <div className="min-w-[9rem]">
                    <Campo label="Unidade">
                      <span className="font-mono text-lg font-semibold uppercase tracking-wide">
                        {formatIsoDisplay(row.unidadeIso)}
                      </span>
                      {unidadeDetalhe ? (
                        <p className="text-xs font-normal text-muted-foreground">{unidadeDetalhe}</p>
                      ) : null}
                      {row.lacreTroca ? (
                        <p className="mt-1 text-xs font-medium text-amber-400">
                          {row.lacreTroca.texto}
                        </p>
                      ) : row.lacre ? (
                        <p className="mt-1 text-xs text-muted-foreground">Lacre {row.lacre}</p>
                      ) : null}
                      {row.handlingValor && row.handlingValor > 0 ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Handling {formatBRL(row.handlingValor)}
                          {row.valorLancado && row.valorLancado > row.handlingValor
                            ? ` · pré-fatura ${formatBRL(row.valorLancado)}`
                            : ""}
                        </p>
                      ) : row.valorLancado && row.valorLancado > 0 ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Pré-fatura {formatBRL(row.valorLancado)}
                        </p>
                      ) : null}
                    </Campo>
                  </div>
                  <div className="min-w-[10rem] flex-1">
                    <Campo label="Cliente">
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
                    </Campo>
                  </div>
                  <div className="min-w-[14rem] flex-1">
                    <LegResumo titulo="Entrada" leg={row.entrada} />
                    {expandido && (row.entrada.processo !== "—" || row.entrada.navio !== "—") ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {row.entrada.processo !== "—" ? `Proc. ${row.entrada.processo}` : ""}
                        {row.entrada.processo !== "—" && row.entrada.navio !== "—" ? " · " : ""}
                        {row.entrada.navio !== "—" ? `Navio ${row.entrada.navio}` : ""}
                      </p>
                    ) : null}
                  </div>
                  <div className="min-w-[12rem] flex-1">
                    <LegResumo titulo="Saída" leg={row.saida} />
                  </div>
                  <div className="ml-auto shrink-0">
                    <RicAcoes row={row} onCeder={() => setCessaoId(row.id)} />
                  </div>
                </div>
                {expandido ? (
                  <div className="mt-4 space-y-3">
                    {row.tomadaReefer ? (
                    <TomadaGateCard
                      unidadeIso={row.unidadeIso}
                      podeOperar={row.status === "ABERTO"}
                      onChanged={() => {
                        setServicosTick((n) => n + 1);
                        void carregar({ silencioso: true });
                      }}
                    />
                    ) : null}
                    <ServicosIdCard
                      key={`${row.id}-${servicosTick}`}
                      unidadeProcessoId={row.id}
                      numero={row.numero}
                      podeLancar={row.status === "ABERTO"}
                      onChanged={() => {
                        setServicosTick((n) => n + 1);
                        void carregar({ silencioso: true });
                      }}
                    />
                  </div>
                ) : null}
              </div>
            );
          })}
          <p className="px-1 text-xs text-muted-foreground">{items.length} ID(s) no período.</p>
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
