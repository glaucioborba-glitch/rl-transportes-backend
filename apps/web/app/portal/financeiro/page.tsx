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
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { KpiCard, SectionTitle } from "@/components/portal/portal-primitives";
import { PortalTable } from "@/components/portal/portal-table";
import { RawStatusBadge } from "@/components/portal/status-badge";
import { boletoStatusVariant } from "@/lib/portal-status";
import {
  ApiError,
  criarPixCreditoContaCorrente,
  enviarComprovantePixCredito,
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

function nfseNumero(row: PortalFatEnvelope) {
  const n = row.nfsEmitidas?.[0];
  return n?.numeroNfe?.trim() || "—";
}

function nfseStatus(row: PortalFatEnvelope) {
  const n = row.nfsEmitidas?.[0];
  return (n?.statusIpm || row.statusNfe || "—").trim() || "—";
}

function nfseStatusVariant(status: string) {
  const s = status.toLowerCase();
  if (/autoriz|aprov|emitid|ok|sucesso/.test(s)) return "aprovado" as const;
  if (/rejeit|cancel|erro|negad/.test(s)) return "rejeitado" as const;
  if (/pend|process|aguard/.test(s)) return "pendente" as const;
  return "neutral" as const;
}

/** PIX: FAT, NFS-e, status e valor no mesmo quadrado. */
function FatPixCard({ row }: { row: PortalFatEnvelope }) {
  const valor = Number(row.valorTotal ?? 0);
  const status = nfseStatus(row);
  return (
    <div className="flex h-full flex-col rounded-xl border border-white/10 bg-black/20 p-4">
      <p className="text-[11px] font-medium uppercase tracking-widest text-slate-400">Fatura</p>
      <p className="mt-1 font-semibold tabular-nums text-white">{row.numeroFat?.trim() || "—"}</p>
      {(row.referencia || row.periodo) && (
        <p className="mt-0.5 text-xs text-slate-500">{row.referencia || row.periodo}</p>
      )}
      <dl className="mt-4 grid flex-1 gap-3 text-sm">
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-slate-500">NFS-e</dt>
          <dd className="mt-0.5 font-medium tabular-nums text-white">{nfseNumero(row)}</dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-slate-500">Status</dt>
          <dd className="mt-1">
            <RawStatusBadge label={status} variant={nfseStatusVariant(status)} />
          </dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-slate-500">Valor</dt>
          <dd className="mt-0.5 text-lg font-semibold tabular-nums text-white">
            {formatBRL(Number.isFinite(valor) ? valor : 0)}
          </dd>
        </div>
      </dl>
      <Button variant="outline" size="sm" className="mt-4 w-full" asChild>
        <Link href={hrefPortalFat(row)}>Abrir</Link>
      </Button>
    </div>
  );
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
  const [pixComprovante, setPixComprovante] = useState<File | null>(null);
  const [pixComprovanteEnviando, setPixComprovanteEnviando] = useState(false);
  const [pixComprovanteEnviado, setPixComprovanteEnviado] = useState(false);

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

  async function enviarComprovante() {
    if (!pixResult) return;
    if (!pixComprovante) {
      toast.error("Selecione o comprovante do PIX (JPG, PNG ou PDF).");
      return;
    }
    if (pixComprovante.size > 5 * 1024 * 1024) {
      toast.error("O comprovante não pode passar de 5 MB.");
      return;
    }
    setPixComprovanteEnviando(true);
    try {
      await enviarComprovantePixCredito({
        valor: pixResult.valor,
        referenciaExterna: pixResult.referenciaExterna,
        file: pixComprovante,
      });
      setPixComprovanteEnviado(true);
      toast.success("Comprovante enviado para análise manual.");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Não foi possível enviar o comprovante.");
    } finally {
      setPixComprovanteEnviando(false);
    }
  }

  function fecharPixDialog(open: boolean) {
    setPixOpen(open);
    if (!open) {
      setPixValor("");
      setPixResult(null);
      setPixLoading(false);
      setPixComprovante(null);
      setPixComprovanteEnviando(false);
      setPixComprovanteEnviado(false);
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
                ? "Faturas FAT com demonstrativo, NFS-e e boleto. Previsão de estadia até a saída fica na Simulação de valores."
                : "Faturas FAT com demonstrativo e NFS-e. Previsão de estadia até a saída fica na Simulação de valores."
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
                Para simular a estadia até uma data de saída, abra{" "}
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
        <DialogContent className="max-h-[90vh] overflow-y-auto">
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
          {pixResult ? (
            <div className="space-y-3 border-t border-white/10 pt-4">
              <Label htmlFor="pix-comprovante">Comprovante do PIX</Label>
              <Input
                id="pix-comprovante"
                type="file"
                accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
                disabled={pixComprovanteEnviado || pixComprovanteEnviando}
                onChange={(e) => setPixComprovante(e.target.files?.[0] ?? null)}
              />
              {pixComprovante ? (
                <p className="text-xs text-emerald-300">{pixComprovante.name}</p>
              ) : null}
              <p className="text-xs leading-relaxed text-slate-400">
                Está com dificuldades? Envie o comprovante do PIX para análise manual. Ela acontece de segunda a
                sexta, das 9:00 às 18:00 horas e pode levar até 2 horas para ser confirmada e o saldo entrar em sua
                conta. Crédito não garantido, depende de verificação.
              </p>
              <Button
                type="button"
                variant="outline"
                disabled={pixComprovanteEnviado || pixComprovanteEnviando}
                onClick={() => void enviarComprovante()}
              >
                {pixComprovanteEnviado
                  ? "Comprovante enviado"
                  : pixComprovanteEnviando
                    ? "Enviando…"
                    : "Enviar comprovante"}
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <CardTitle>{layoutPix ? "Fatura" : "FAT"}</CardTitle>
        </CardHeader>
        {layoutPix ? (
          <CardContent>
            {fats.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-500">Nenhum registro</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {fats.map((r) => (
                  <FatPixCard key={`${r.origem}-${r.id}`} row={r} />
                ))}
              </div>
            )}
          </CardContent>
        ) : (
        <CardContent className="p-0">
          <PortalTable
            columns={[
              { key: "fat", header: "FAT" },
              { key: "ref", header: "Referência" },
              { key: "nfse", header: "NFS-e" },
              { key: "boleto", header: "Boleto" },
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
        )}
      </Card>

      {layoutPix ? null : (
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
      )}
    </main>
  );
}
