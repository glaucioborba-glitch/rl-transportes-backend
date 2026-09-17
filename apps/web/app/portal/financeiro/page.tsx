"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { MoneyInput } from "@/components/ui/money-input";
import { KpiCard, SectionTitle } from "@/components/portal/portal-primitives";
import { PortalTable } from "@/components/portal/portal-table";
import { RawStatusBadge } from "@/components/portal/status-badge";
import { boletoStatusVariant } from "@/lib/portal-status";
import {
  ApiError,
  criarPixCreditoContaCorrente,
  fetchBoletosPaginated,
  fetchFaturamentoPaginated,
  fetchNfsePaginated,
  fetchPortalContaCorrente,
  fetchPortalDashboard,
  hrefPortalFat,
  type PortalContaCorrente,
  type PortalFatEnvelope,
  type PortalPixCreditoContaCorrente,
} from "@/lib/api/portal-client";
import { toast } from "@/lib/toast";
import { Skeleton } from "@/components/ui/skeleton";
import { isLayoutFaturamentoPortal, isLayoutPixPortal, textoCondicaoVigente } from "@/lib/condicao-pagamento-portal";
import { parseValorBrl } from "@/lib/financeiro/conta-corrente-display";
import { formatBRL } from "@/lib/financeiro/format";
import { DEFAULT_PORTAL_HOME } from "@/lib/portal-redirect";

function saldoClass(situacao: PortalContaCorrente["cliente"]["situacao"] | undefined) {
  if (situacao === "CREDOR") return "text-emerald-400";
  if (situacao === "DEVEDOR") return "text-red-400";
  return "text-white";
}

function nfseResumo(row: PortalFatEnvelope) {
  const n = row.nfsEmitidas?.[0];
  if (n?.numeroNfe) return n.numeroNfe;
  return String(row.statusNfe || "—");
}

function boletoResumo(row: PortalFatEnvelope) {
  const b = row.boletos?.[0];
  if (b?.numeroBoleto) return b.numeroBoleto;
  return String(row.statusBoleto || "—");
}

export default function FinanceiroPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [fats, setFats] = useState<PortalFatEnvelope[]>([]);
  const [boletos, setBoletos] = useState<Record<string, unknown>[]>([]);
  const [nfs, setNfs] = useState<Record<string, unknown>[]>([]);
  const [cc, setCc] = useState<PortalContaCorrente["cliente"] | null>(null);
  const [vencidos, setVencidos] = useState(0);
  const [pendenteVal, setPendenteVal] = useState(0);
  const [faturamentoLista, setFaturamentoLista] = useState(0);
  const [condicaoPagamento, setCondicaoPagamento] = useState<string | null>(null);
  const [prazoPagamento, setPrazoPagamento] = useState<string | null>(null);
  const [condicaoPagamentoLabel, setCondicaoPagamentoLabel] = useState<string | null>(null);
  const [prazoPagamentoLabel, setPrazoPagamentoLabel] = useState<string | null>(null);
  const [statusCadastro, setStatusCadastro] = useState<
    "PENDENTE_ANALISE_FINANCEIRA" | "APROVADO" | "REJEITADO" | null
  >(null);
  const [pixOpen, setPixOpen] = useState(false);
  const [pixValor, setPixValor] = useState("");
  const [pixLoading, setPixLoading] = useState(false);
  const [pixResult, setPixResult] = useState<PortalPixCreditoContaCorrente | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [fatRes, bolRes, nfRes, dashRes, ccRes] = await Promise.allSettled([
        fetchFaturamentoPaginated({ page: 1, limit: 50 }),
        fetchBoletosPaginated({ page: 1, limit: 100 }),
        fetchNfsePaginated({ page: 1, limit: 50 }),
        fetchPortalDashboard({ recentPage: 1, recentLimit: 1 }),
        fetchPortalContaCorrente(),
      ]);
      const failed = [fatRes, bolRes, nfRes, dashRes, ccRes].find((r) => r.status === "rejected");
      if (failed && failed.status === "rejected") {
        toast.error(
          failed.reason instanceof ApiError ? failed.reason.message : "Erro ao carregar financeiro",
        );
      }

      const fat = fatRes.status === "fulfilled" ? fatRes.value : { items: [] as PortalFatEnvelope[] };
      const bol = bolRes.status === "fulfilled" ? bolRes.value : { items: [] };
      const nf = nfRes.status === "fulfilled" ? nfRes.value : { items: [] };
      const dash = dashRes.status === "fulfilled" ? dashRes.value : null;
      const ccOut = ccRes.status === "fulfilled" ? ccRes.value : null;

      const fatItems = fat.items ?? [];
      setFats(fatItems);
      setBoletos(bol.items ?? []);
      setNfs(nf.items ?? []);
      setCc(ccOut?.cliente ?? null);
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
      if (dash) {
        setCondicaoPagamento(dash.condicaoPagamento ?? null);
        setPrazoPagamento(dash.prazoPagamento ?? null);
        setCondicaoPagamentoLabel(dash.condicaoPagamentoLabel ?? null);
        setPrazoPagamentoLabel(dash.prazoPagamentoLabel ?? null);
        setStatusCadastro(dash.statusCadastro ?? null);
      }
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Erro ao carregar financeiro");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function gerarPixCredito() {
    const valor = parseValorBrl(pixValor);
    if (!Number.isFinite(valor) || valor < 0.01) {
      toast.error("Informe um valor válido para o crédito.");
      return;
    }
    setPixLoading(true);
    try {
      const out = await criarPixCreditoContaCorrente({ valor });
      setPixResult(out);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Não foi possível gerar o QR Code PIX");
    } finally {
      setPixLoading(false);
    }
  }

  async function copiarPix() {
    if (!pixResult?.pixCopiaCola) return;
    try {
      await navigator.clipboard.writeText(pixResult.pixCopiaCola);
      toast.success("Código PIX copiado");
    } catch {
      toast.error("Não foi possível copiar o código PIX");
    }
  }

  function fecharPixDialog(open: boolean) {
    setPixOpen(open);
    if (!open) {
      setPixValor("");
      setPixResult(null);
      setPixLoading(false);
    }
  }

  if (loading) {
    return (
      <main className="mx-auto w-[90%] px-4 py-8">
        <Skeleton className="h-40 w-full" />
      </main>
    );
  }

  const inad = boletos.length ? Math.round((vencidos / boletos.length) * 100) : 0;
  const condicao = textoCondicaoVigente({
    statusCadastro,
    condicaoPagamento,
    prazoPagamento,
    condicaoPagamentoLabel,
    prazoPagamentoLabel,
  });
  const layoutFaturamento = isLayoutFaturamentoPortal({ statusCadastro, condicaoPagamento });
  const layoutPix = isLayoutPixPortal({ statusCadastro, condicaoPagamento });

  return (
    <main className="mx-auto w-[90%] space-y-8 px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Button variant="ghost" size="sm" className="-ml-2 mb-2 text-slate-400 hover:text-white" asChild>
            <Link href={DEFAULT_PORTAL_HOME}>
              <ArrowLeft className="mr-1 h-4 w-4" />
              Voltar
            </Link>
          </Button>
          <SectionTitle
            className="mb-0"
            title="Financeiro"
            description={
              layoutFaturamento
                ? "Faturas FAT com demonstrativo, NFS-e e boleto. Estimativas de diárias e extras ficam na Simulação de valores."
                : "Faturas FAT com demonstrativo e NFS-e. Estimativas de diárias e extras ficam na Simulação de valores."
            }
          />
        </div>
        {cc ? (
          <div className="rounded-lg border border-white/10 bg-black/20 px-4 py-3 text-right">
            <p className="text-[11px] font-medium uppercase tracking-widest text-white">Conta corrente</p>
            <button
              type="button"
              aria-label="Abrir extrato da conta corrente"
              onClick={() => router.push("/portal/financeiro/conta-corrente")}
              className={`mt-1 block text-4xl font-bold tabular-nums hover:underline ${saldoClass(cc.situacao)}`}
            >
              {formatBRL(cc.saldo)}
            </button>
            <p className="mt-0.5 text-xs text-white">{cc.situacaoLabel}</p>
          </div>
        ) : null}
      </div>

      <div className="grid items-stretch gap-4 sm:grid-cols-3">
        <Card className="h-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <span aria-hidden>💳</span>
              Condição de Pagamento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm font-medium text-white">{condicao.titulo}</p>
            <p className="mt-1 text-sm text-muted-foreground">{condicao.descricao}</p>
            {layoutFaturamento || layoutPix ? (
              <p className="mt-2 text-xs text-slate-500">
                Para simular valores de estadia e serviços, abra{" "}
                <Link href="/portal/simulacao-valores" className="text-[var(--accent)] underline-offset-2 hover:underline">
                  Simulação de valores
                </Link>
                .
              </p>
            ) : null}
          </CardContent>
        </Card>

        <KpiCard
          title="Soma faturas (página)"
          value={formatBRL(faturamentoLista)}
          hint="Total das faturas FAT retornadas nesta página"
        />

        <Card className="h-full overflow-hidden p-0">
          <button
            type="button"
            aria-label="Adicionar crédito à sua conta corrente"
            onClick={() => setPixOpen(true)}
            className="flex h-full w-full flex-col rounded-2xl text-left transition-colors hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <span aria-hidden>💳</span>
                Crédito na conta corrente
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm font-medium text-white">Adicionar crédito à sua conta corrente</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Gere um QR Code PIX para incluir valor no saldo.
              </p>
              <p className="mt-2 text-xs text-[var(--accent)]">Gerar QR Code PIX</p>
            </CardContent>
          </button>
        </Card>
      </div>

      {layoutPix ? null : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <KpiCard title="Inadimplência (proxy)" value={`${inad}%`} hint="Boletos pendentes vencidos / total listado" />
          <KpiCard title="Valor pendente" value={formatBRL(pendenteVal)} hint="Soma boletos pendentes + vencidos" />
          <KpiCard title="Boletos vencidos" value={vencidos} />
        </div>
      )}

      <Dialog open={pixOpen} onOpenChange={fecharPixDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar crédito à sua conta corrente</DialogTitle>
            <DialogDescription>
              Informe o valor. O QR Code PIX é gerado pela API do banco configurado no terminal. O saldo entra após a
              confirmação do pagamento.
            </DialogDescription>
          </DialogHeader>
          {pixResult ? (
            <div className="space-y-3">
              <p className="text-sm text-white">
                Valor: <span className="font-semibold tabular-nums">{formatBRL(pixResult.valor)}</span>
              </p>
              {pixResult.pixQrCodeUrl ? (
                <div className="flex justify-center rounded-lg bg-white p-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={pixResult.pixQrCodeUrl} alt="QR Code PIX" className="h-56 w-56" />
                </div>
              ) : null}
              <Label htmlFor="pix-copia-cola">PIX copia e cola</Label>
              <textarea
                id="pix-copia-cola"
                readOnly
                value={pixResult.pixCopiaCola}
                className="min-h-[4.5rem] w-full resize-none rounded-lg border border-white/10 bg-black/30 p-2 font-mono text-xs text-white"
              />
              {pixResult.sandbox ? (
                <p className="text-xs text-amber-400/90">Ambiente de teste (sandbox) — o banco do terminal ainda não está configurado.</p>
              ) : null}
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="pix-valor">Valor</Label>
              <MoneyInput
                id="pix-valor"
                value={pixValor}
                onChange={setPixValor}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void gerarPixCredito();
                }}
              />
            </div>
          )}
          <DialogFooter>
            {pixResult ? (
              <Button type="button" variant="outline" onClick={() => void copiarPix()}>
                <Copy className="h-4 w-4" />
                Copiar código PIX
              </Button>
            ) : (
              <Button type="button" disabled={pixLoading} onClick={() => void gerarPixCredito()}>
                {pixLoading ? "Gerando QR Code…" : "Gerar QR Code PIX"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <CardTitle>FAT</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <PortalTable
            columns={[
              { key: "fat", header: "FAT" },
              { key: "ref", header: "Referência" },
              { key: "nfse", header: "NFS-e" },
              ...(layoutPix ? [] : [{ key: "boleto", header: "Boleto" }]),
              { key: "act", header: "" },
            ]}
            rows={fats}
            getRowKey={(r) => `${r.origem}-${r.id}`}
            renderCell={(r, key) => {
              if (key === "fat") return r.numeroFat || "—";
              if (key === "ref") return r.referencia || r.periodo || "—";
              if (key === "nfse") return nfseResumo(r);
              if (key === "boleto") return boletoResumo(r);
              if (key === "act")
                return (
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={hrefPortalFat(r)}>Abrir</Link>
                  </Button>
                );
              return null;
            }}
          />
        </CardContent>
      </Card>

      <div className={layoutPix ? "grid gap-6" : "grid gap-6 lg:grid-cols-2"}>
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
        )}

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
