"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/portal/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ApiError,
  aprovarSolicitacao,
  fetchSolicitacao,
  fetchSolicitacaoHistoricoAlteracoes,
  fetchSolicitacaoVistorias,
  portalDownloadSolicitacaoV2Pdf,
  type SolicitacaoRow,
} from "@/lib/api/portal-client";
import { formatDateTime } from "@/lib/portal-tracking";
import { formatTipoTamanhoContainerLabel } from "@/lib/cadastros/tipo-container-tamanhos";
import type { VistoriaPortalRow } from "@/lib/gate-vistoria";
import { VistoriaGallery } from "@/components/portal/vistoria-gallery";
import { collectSolicitacaoContainerISOs } from "@/lib/container-display";
import { ContainerNumber } from "@/components/ui/container-number";
import { ProtocolRefLabel } from "@/components/shared/operation-identity";
import { toast } from "@/lib/toast";
import { usePortalAuthStore } from "@/stores/portal-store";
import { usePessoaPermissoesStore } from "@/stores/pessoaPermissoesStore";
import { SolicitacaoHistoricoAlteracoes } from "@/components/solicitacao/solicitacao-historico-alteracoes";

function PhotoStrip({ title, urls }: { title: string; urls: unknown }) {
  const list = Array.isArray(urls) ? urls.filter((u) => typeof u === "string") : [];
  if (!list.length) return null;
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-slate-300">{title}</p>
      <div className="flex flex-wrap gap-2">
        {list.slice(0, 8).map((src) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={src}
            src={String(src)}
            alt=""
            className="h-20 w-28 rounded-lg border border-white/10 object-cover"
          />
        ))}
      </div>
    </div>
  );
}

function Step({
  label,
  done,
  detail,
}: {
  label: string;
  done: boolean;
  detail?: string;
}) {
  return (
    <div className="flex gap-3 border-l border-white/10 pl-4 transition-opacity duration-200">
      <div
        className={`mt-1 h-2 w-2 shrink-0 rounded-full ${done ? "bg-[var(--accent)]" : "bg-white/20"}`}
      />
      <div>
        <p className={`text-sm font-medium ${done ? "text-white" : "text-slate-500"}`}>{label}</p>
        {detail ? <p className="text-xs text-slate-500">{detail}</p> : null}
      </div>
    </div>
  );
}

function phaseDetail(phase: unknown): string | undefined {
  if (!phase || typeof phase !== "object") return undefined;
  const c = (phase as { createdAt?: string }).createdAt;
  return c ? formatDateTime(c) : undefined;
}

export default function SolicitacaoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const bumpDashboard = usePortalAuthStore((s) => s.bumpDashboard);
  const permissoes = usePessoaPermissoesStore((s) => s.permissoes);
  const [row, setRow] = useState<SolicitacaoRow | null>(null);
  const [vistorias, setVistorias] = useState<VistoriaPortalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [aproving, setAproving] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const s = await fetchSolicitacao(id);
        if (!cancelled) setRow(s);
        try {
          const v = await fetchSolicitacaoVistorias(id);
          if (!cancelled) setVistorias(v);
        } catch {
          if (!cancelled) setVistorias([]);
        }
      } catch (e) {
        toast.error(e instanceof ApiError ? e.message : "Erro ao carregar");
        if (!cancelled) router.push("/portal/solicitacoes");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, router]);

  async function onBaixarPdfCorporativo() {
    if (!id) return;
    setPdfBusy(true);
    try {
      const blob = await portalDownloadSolicitacaoV2Pdf(id);
      const url = URL.createObjectURL(blob);
      const w = window.open(url, "_blank", "noopener,noreferrer");
      if (w) setTimeout(() => URL.revokeObjectURL(url), 60_000);
      else URL.revokeObjectURL(url);
      if (!w) toast.error("Permita pop-ups para visualizar o PDF");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Falha ao gerar PDF");
    } finally {
      setPdfBusy(false);
    }
  }

  async function onAprovar() {
    if (!id) return;
    setAproving(true);
    try {
      await aprovarSolicitacao(id);
      const next = await fetchSolicitacao(id);
      setRow(next);
      bumpDashboard();
      toast.success("Solicitação aprovada");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Falha ao aprovar");
    } finally {
      setAproving(false);
    }
  }

  if (loading || !row) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-8">
        <Skeleton className="h-40 w-full" />
      </main>
    );
  }

  const isCorporativa = Boolean(row.transporteSolicitacao);
  const p = row.portaria;

  const isos = collectSolicitacaoContainerISOs(row);

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-2">
          <ContainerNumber value={isos[0] ?? "—"} size="lg" />
          <ProtocolRefLabel protocolo={row.protocolo} prefix="Protocolo:" />
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          <StatusBadge status={row.status} />
          {isCorporativa && permissoes?.podeGerarPDF ? (
            <Button
              type="button"
              variant="outline"
              disabled={pdfBusy}
              onClick={() => void onBaixarPdfCorporativo()}
            >
              {pdfBusy ? "…" : "Baixar PDF"}
            </Button>
          ) : null}
          {row.status === "PENDENTE" && !isCorporativa && permissoes?.podeAprovarOS ? (
            <Button disabled={aproving} onClick={() => void onAprovar()}>
              {aproving ? "…" : "Aprovar"}
            </Button>
          ) : null}
          <Button variant="outline" asChild>
            <Link href="/portal/solicitacoes">Voltar</Link>
          </Button>
        </div>
      </div>
      <p className="text-sm text-slate-400">
        Cliente · {row.cliente?.razaoSocial ?? "—"} · {formatDateTime(row.createdAt)}
      </p>

      <Tabs defaultValue={isCorporativa ? "corporativa" : "unidades"} className="w-full">
        <TabsList className="w-full justify-start overflow-x-auto">
          {isCorporativa ? <TabsTrigger value="corporativa">Dados da solicitação</TabsTrigger> : null}
          <TabsTrigger value="unidades">Unidades</TabsTrigger>
          <TabsTrigger value="eventos">Eventos</TabsTrigger>
          {isCorporativa ? <TabsTrigger value="historico">Histórico de Alterações</TabsTrigger> : null}
          <TabsTrigger value="documentos">Documentos</TabsTrigger>
        </TabsList>

        {isCorporativa ? (
          <TabsContent value="corporativa" className="space-y-6">
            {row.transporteSolicitacao ? (
              <Card>
                <CardHeader>
                  <CardTitle>Transporte</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-2 text-sm text-slate-300 sm:grid-cols-2">
                  <p>
                    Motorista: <span className="text-white">{row.transporteSolicitacao.nomeMotorista}</span>
                  </p>
                  <p>
                    CPF: <span className="font-mono text-white">{row.transporteSolicitacao.cpfMotorista}</span>
                  </p>
                  <p>
                    Tipo: <span className="text-white">{row.transporteSolicitacao.tipoCaminhao}</span>
                  </p>
                  <p>
                    Placas:{" "}
                    <span className="font-mono text-white">
                      {row.transporteSolicitacao.placaCavalo} · {row.transporteSolicitacao.placaCarreta01}
                      {row.transporteSolicitacao.placaCarreta02
                        ? ` · ${row.transporteSolicitacao.placaCarreta02}`
                        : ""}
                    </span>
                  </p>
                </CardContent>
              </Card>
            ) : null}
            {(row.containersSolicitacao?.length ?? 0) > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle>Containers</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {(row.containersSolicitacao ?? []).map((c) => (
                    <div key={c.id} className="rounded-lg border border-white/10 bg-black/20 p-3 text-sm">
                      <ContainerNumber value={c.unidade} size="md" />
                      <p className="mt-1 text-xs text-slate-500">Unidade #{c.ordem}</p>
                      <p className="text-slate-400">
                        {c.booking} · {c.status}
                        {c.refrigerado ? ` · reefer ${c.setPoint ?? "—"}°C` : ""}
                      </p>
                      <p className="text-xs text-slate-500">
                        {c.processo} ·{" "}
                        {formatTipoTamanhoContainerLabel(c.tipo, c.tamanho) ?? "—"}
                        {c.lacre ? ` · lacre ${c.lacre}` : ""}
                      </p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ) : null}
            {row.agendamentoSolicitacao ? (
              <Card>
                <CardHeader>
                  <CardTitle>Agendamento</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-slate-300">
                  <p>
                    Data:{" "}
                    <span className="text-white">
                      {String(row.agendamentoSolicitacao.dataRef).slice(0, 10)}
                    </span>
                  </p>
                  <p>
                    Turno: <span className="text-white">{row.agendamentoSolicitacao.turno}</span>
                  </p>
                  {row.agendamentoSolicitacao.atendimentoEspecial ? (
                    <p>
                      Atendimento especial:{" "}
                      <span className="text-white">
                        {row.agendamentoSolicitacao.atendimentoEspecialTexto || "sim"}
                      </span>
                    </p>
                  ) : null}
                </CardContent>
              </Card>
            ) : null}
            {row.solicitanteContato ? (
              <Card>
                <CardHeader>
                  <CardTitle>Contato do solicitante</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-slate-300">
                  <p className="text-white">{row.solicitanteContato.nome}</p>
                  <p>{row.solicitanteContato.telefone}</p>
                  <p>{row.solicitanteContato.email}</p>
                </CardContent>
              </Card>
            ) : null}
            {(row.anexosSolicitacao?.length ?? 0) > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle>Anexos</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {(row.anexosSolicitacao ?? []).map((a) => (
                    <div key={a.id} className="flex flex-wrap justify-between gap-2 border-b border-white/5 py-2">
                      <span className="text-white">{a.filename}</span>
                      <span className="text-slate-500">
                        {a.mimeType} · {(a.size / 1024).toFixed(0)} KB
                      </span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ) : null}
            {isCorporativa ? (
              <p className="text-xs text-slate-500">
                Esta solicitação segue o fluxo corporativo: aprovação pela equipe RL (status permanece pendente até
                análise).
              </p>
            ) : null}
          </TabsContent>
        ) : null}

        <TabsContent value="unidades" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Contêineres</CardTitle>
              <CardDescription>ISO e tipo vinculados à solicitação.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {(row.unidades ?? []).length ? (
                (row.unidades ?? []).map((u) => (
                  <div
                    key={u.id}
                    className="flex flex-col gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <ContainerNumber value={u.numeroIso} showLabel={false} size="sm" />
                      <p className="text-xs text-slate-500">{u.tipo}</p>
                    </div>
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/portal/unidades/${u.id}`}>Linha do tempo</Link>
                    </Button>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500">Nenhuma unidade listada.</p>
              )}
            </CardContent>
          </Card>

          {p ? (
            <Card>
              <CardHeader>
                <CardTitle>Fotos (portaria legado)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <PhotoStrip title="Contêiner" urls={p.fotosContainer} />
                <PhotoStrip title="Cavalo" urls={p.fotosCaminhao} />
                <PhotoStrip title="Lacre" urls={p.fotosLacre} />
                <PhotoStrip title="Avarias" urls={p.fotosAvarias} />
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>Vistoria Gate (escudo de responsabilidade)</CardTitle>
              <CardDescription>
                4 fotos obrigatórias por entrada/saída e avarias registradas no gate operacional.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <VistoriaGallery vistorias={vistorias} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="eventos">
          <Card>
            <CardHeader>
              <CardTitle>Ciclo operacional</CardTitle>
              <CardDescription>Portaria → Gate → Pátio → Saída (dados da solicitação).</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Step label="Portaria" done={!!row.portaria} detail={phaseDetail(row.portaria)} />
              <Step label="Gate" done={!!row.gate} detail={phaseDetail(row.gate)} />
              <Step label="Pátio" done={!!row.patio} detail={phaseDetail(row.patio)} />
              <Step label="Saída" done={!!row.saida} detail={phaseDetail(row.saida)} />
            </CardContent>
          </Card>
        </TabsContent>

        {isCorporativa && id ? (
          <TabsContent value="historico">
            <SolicitacaoHistoricoAlteracoes solicitacaoId={id} load={fetchSolicitacaoHistoricoAlteracoes} />
          </TabsContent>
        ) : null}

        <TabsContent value="documentos">
          <Card>
            <CardHeader>
              <CardTitle>Documentos</CardTitle>
              <CardDescription>
                Integração futura com NFS-e, boletos e faturas nesta solicitação.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link href="/portal/documentos">Central de documentos</Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link href="/portal/financeiro">Financeiro</Link>
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </main>
  );
}
