"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  CircleDot,
  LogOut,
  Paperclip,
  PencilLine,
  Truck,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ApiError,
  staffAprovarSolicitacaoV2,
  staffDownloadSolicitacaoV2Pdf,
  staffFetchSolicitacaoV2Detalhe,
  staffRejeitarSolicitacaoV2,
  staffRemoverAnexoV2,
  staffUploadAnexoV2,
} from "@/lib/api/staff-client";
import { toast } from "@/lib/toast";
import { collectSolicitacaoContainerISOs } from "@/lib/container-display";
import { OperationPageHeader } from "@/components/shared/operation-identity";

function TimelineIcon({ tipo }: { tipo: string }) {
  const cls = "h-4 w-4 shrink-0 text-violet-300/90";
  switch (tipo) {
    case "criacao":
      return <CircleDot className={cls} />;
    case "anexo":
      return <Paperclip className={cls} />;
    case "delta":
      return <PencilLine className={`${cls} text-cyan-300`} />;
    case "aprovacao":
      return <CheckCircle2 className={`${cls} text-emerald-300`} />;
    case "rejeicao":
      return <XCircle className={`${cls} text-rose-300`} />;
    case "alerta":
      return <AlertTriangle className={`${cls} text-amber-300`} />;
    case "gate_in":
      return <Truck className={`${cls} text-sky-300`} />;
    case "gate_out":
      return <LogOut className={`${cls} text-lime-300`} />;
    default:
      return <CircleDot className={cls} />;
  }
}

export default function StaffSolicitacaoV2DetailPage() {
  const { id } = useParams<{ id: string }>();
  const fileRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Awaited<ReturnType<typeof staffFetchSolicitacaoV2Detalhe>> | null>(null);
  const [motivo, setMotivo] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      setData(await staffFetchSolicitacaoV2Detalhe(id));
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Erro ao carregar");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const sol = data?.solicitacao as Record<string, unknown> | undefined;
  const ts = sol?.transporteSolicitacao as Record<string, unknown> | undefined;
  const containers = (sol?.containersSolicitacao as Record<string, unknown>[] | undefined) ?? [];
  const anexos = (sol?.anexosSolicitacao as Record<string, unknown>[] | undefined) ?? [];
  const timeline = data?.timeline ?? [];

  async function onBaixarPdf() {
    if (!id) return;
    setPdfBusy(true);
    try {
      const blob = await staffDownloadSolicitacaoV2Pdf(id);
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
    setBusy("aprov");
    try {
      await staffAprovarSolicitacaoV2(id);
      toast.success("Solicitação aprovada");
      await load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Falha");
    } finally {
      setBusy(null);
    }
  }

  async function onRejeitar() {
    if (!id) return;
    setBusy("rej");
    try {
      await staffRejeitarSolicitacaoV2(id, motivo.trim() || undefined);
      toast.success("Solicitação rejeitada");
      await load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Falha");
    } finally {
      setBusy(null);
    }
  }

  async function onRemoveAnexo(aid: string) {
    setBusy(`del-${aid}`);
    try {
      await staffRemoverAnexoV2(aid);
      toast.success("Anexo removido");
      await load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Falha");
    } finally {
      setBusy(null);
    }
  }

  async function onPickAnexo(e: React.ChangeEvent<HTMLInputElement>) {
    if (!id) return;
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setBusy("up");
    try {
      await staffUploadAnexoV2(id, f);
      toast.success("Documento anexado");
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Falha no upload");
    } finally {
      setBusy(null);
    }
  }

  if (loading && !data) {
    return (
      <div className="mx-auto max-w-6xl space-y-4 p-6">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!data || !sol) {
    return (
      <div className="p-6">
        <p className="text-sm text-zinc-400">Solicitação não encontrada.</p>
        <Button variant="outline" className="mt-4" asChild>
          <Link href="/staff/solicitacoes-v2">Voltar</Link>
        </Button>
      </div>
    );
  }

  const status = String(sol.status ?? "");
  const statusV2 = data.statusV2Label ?? "";
  const resumo = data.resumoRisco;
  const canAct = status === "PENDENTE" || status === "EM_ANALISE";
  const tipoCam = ts ? String(ts.tipoCaminhao ?? "") : "";
  const isLs = tipoCam === "LS";

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <OperationPageHeader
        isos={collectSolicitacaoContainerISOs({
          containersSolicitacao: containers as Array<{ unidade?: string; ordem?: number }>,
        })}
        protocolo={String(sol.protocolo ?? id)}
        eyebrow={
          <p className="text-xs font-semibold uppercase tracking-widest text-violet-400/90">
            Solicitação v2
          </p>
        }
        actions={
          <>
            {tipoCam ? (
              <span
                className={`rounded-md px-2 py-0.5 text-xs font-semibold ${
                  isLs ? "bg-sky-600/35 text-sky-100" : "bg-amber-600/35 text-amber-100"
                }`}
              >
                {isLs ? "LS" : "Rodotrem"}
              </span>
            ) : null}
            {canAct ? (
              <>
                <Button
                  type="button"
                  className="bg-emerald-600 hover:bg-emerald-500"
                  disabled={busy !== null}
                  onClick={() => void onAprovar()}
                >
                  {busy === "aprov" ? "…" : "Aprovar"}
                </Button>
                <div className="flex min-w-[200px] flex-col gap-1">
                  <Input
                    placeholder="Motivo da rejeição (opcional)"
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    className="border-zinc-600 bg-black/40 text-white"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="border-rose-500/50 text-rose-200 hover:bg-rose-950/50"
                    disabled={busy !== null}
                    onClick={() => void onRejeitar()}
                  >
                    {busy === "rej" ? "…" : "Rejeitar"}
                  </Button>
                </div>
              </>
            ) : null}
            <Button
              type="button"
              variant="default"
              className="bg-sky-700 text-white hover:bg-sky-600"
              disabled={pdfBusy || busy !== null}
              onClick={() => void onBaixarPdf()}
            >
              {pdfBusy ? "PDF…" : "Baixar PDF"}
            </Button>
            <Button variant="outline" className="border-zinc-600" asChild>
              <Link href="/staff/solicitacoes-v2">Lista</Link>
            </Button>
            <Button variant="outline" className="border-zinc-600" asChild>
              <Link href="/staff/fila-operacional">Fila</Link>
            </Button>
          </>
        }
      />
      <p className="text-sm text-zinc-400">
        Status (DB): <span className="text-zinc-200">{status}</span>
        {statusV2 ? (
          <>
            {" "}
            · PDF/relatório: <span className="text-violet-200">{statusV2}</span>
          </>
        ) : null}
      </p>

      {resumo ? (
        <Card className="border-amber-500/20 bg-[#0b101c]/80">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-white">Resumo de risco (módulo)</CardTitle>
            <CardDescription className="text-zinc-500">Alertas de segurança agregados a esta solicitação / cliente.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-6 text-sm text-zinc-300">
            <div>
              <p className="text-xs uppercase text-zinc-500">Alertas</p>
              <p className="text-xl font-semibold text-amber-100/90">{resumo.totalAlertas}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-zinc-500">Risco máx.</p>
              <p className="text-xl font-semibold text-amber-100/90">{resumo.riscoMax ?? "—"}</p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {ts ? (
        <Card className="border-white/10 bg-[#0b101c]/80">
          <CardHeader>
            <CardTitle className="text-lg text-white">Transporte</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm text-zinc-300 sm:grid-cols-2">
            <p>Motorista: {String(ts.nomeMotorista ?? "")}</p>
            <p>CPF: {String(ts.cpfMotorista ?? "")}</p>
            <p>Tipo: {String(ts.tipoCaminhao ?? "")}</p>
            <p>
              Placas: {String(ts.placaCavalo ?? "")} · {String(ts.placaCarreta01 ?? "")}
              {ts.placaCarreta02 ? ` · ${String(ts.placaCarreta02)}` : ""}
            </p>
          </CardContent>
        </Card>
      ) : null}

      {(() => {
        const ag = sol?.agendamentoSolicitacao as Record<string, unknown> | undefined;
        if (!ag) return null;
        return (
          <Card className="border-white/10 bg-[#0b101c]/80">
            <CardHeader>
              <CardTitle className="text-lg text-white">Agendamento</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-zinc-300">
              <p>Data: {String(ag.dataRef ?? ag.data ?? "—").slice(0, 10)}</p>
              <p>Turno: {String(ag.turno ?? "—")}</p>
              <p>Atendimento especial: {ag.atendimentoEspecial ? String(ag.atendimentoEspecialTexto || "sim") : "não"}</p>
            </CardContent>
          </Card>
        );
      })()}

      {(() => {
        const ct = sol?.solicitanteContato as Record<string, unknown> | undefined;
        if (!ct) return null;
        return (
          <Card className="border-white/10 bg-[#0b101c]/80">
            <CardHeader>
              <CardTitle className="text-lg text-white">Contato do solicitante</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-zinc-300">
              <p className="text-white">{String(ct.nome ?? "")}</p>
              <p>{String(ct.telefone ?? "")}</p>
              <p>{String(ct.email ?? "")}</p>
            </CardContent>
          </Card>
        );
      })()}

      <Card className="border-white/10 bg-[#0b101c]/80">
        <CardHeader>
          <CardTitle className="text-lg text-white">Containers</CardTitle>
          <CardDescription className="text-zinc-500">Ordinal #1 / #2 e diferenciadores operacionais.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {containers.length ? (
            containers.map((c) => {
              const ord = Number(c.ordem ?? 0);
              const reefer = Boolean(c.refrigerado);
              return (
                <div
                  key={String(c.id)}
                  className="rounded-lg border border-white/10 bg-black/35 p-3 text-sm text-zinc-300"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded bg-white/10 px-2 py-0.5 text-xs font-bold text-white">#{ord}</span>
                    <span className="font-medium text-white">
                      {String(c.unidade)} · {String(c.booking)}
                    </span>
                    <span className="rounded bg-zinc-800 px-2 py-0.5 text-[10px] uppercase tracking-wide text-zinc-300">
                      {String(c.status)}
                    </span>
                    {reefer ? (
                      <span className="rounded bg-rose-600/30 px-2 py-0.5 text-[10px] font-semibold uppercase text-rose-100">
                        Reefer
                      </span>
                    ) : null}
                    {reefer ? (
                      <span className="rounded bg-sky-600/35 px-2 py-0.5 text-[10px] font-semibold text-sky-100">
                        SetPoint {String(c.setPoint ?? "—")}°C
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-2 text-xs text-zinc-500">
                    {c.lacre ? `Lacre: ${String(c.lacre)}` : "Sem lacre (vazio ou não informado)"}
                  </p>
                </div>
              );
            })
          ) : (
            <p className="text-sm text-zinc-500">—</p>
          )}
        </CardContent>
      </Card>

      <Card className="border-white/10 bg-[#0b101c]/80">
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-lg text-white">Anexos</CardTitle>
            <CardDescription className="text-zinc-500">Operação pode anexar documentos adicionais.</CardDescription>
          </div>
          <div>
            <input
              ref={fileRef}
              type="file"
              accept=".jpg,.jpeg,.pdf,image/jpeg,application/pdf"
              className="hidden"
              onChange={(e) => void onPickAnexo(e)}
            />
            <Button
              type="button"
              variant="default"
              className="bg-violet-600 text-white hover:bg-violet-500"
              disabled={busy !== null}
              onClick={() => fileRef.current?.click()}
            >
              {busy === "up" ? "Enviando…" : "Anexar documentos"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {anexos.length ? (
            anexos.map((a) => (
              <div key={String(a.id)} className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 py-2 text-sm">
                <span className="text-zinc-200">{String(a.filename)}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-rose-300"
                  disabled={busy !== null}
                  onClick={() => void onRemoveAnexo(String(a.id))}
                >
                  {busy === `del-${String(a.id)}` ? "…" : "Excluir"}
                </Button>
              </div>
            ))
          ) : (
            <p className="text-amber-200/90">Sem anexos — aprovação bloqueada até existir documentação.</p>
          )}
        </CardContent>
      </Card>

      <Card className="border-white/10 bg-[#0b101c]/80">
        <CardHeader>
          <CardTitle className="text-lg text-white">Linha do tempo</CardTitle>
          <CardDescription className="text-zinc-500">Criação, anexos, alterações, decisões e alertas.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-0">
          {timeline.length ? (
            <ul className="relative space-y-4 border-l border-white/10 pl-5">
              {timeline.map((ev) => (
                <li key={ev.id} className="relative text-sm">
                  <span className="absolute -left-[1.36rem] top-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-[#151b2a] ring-1 ring-white/10">
                    <TimelineIcon tipo={ev.tipo} />
                  </span>
                  <p className="font-medium text-zinc-100">{ev.titulo}</p>
                  {ev.subtitulo ? <p className="text-xs text-zinc-500">{ev.subtitulo}</p> : null}
                  <p className="mt-0.5 text-[10px] uppercase tracking-wide text-zinc-600">
                    {new Date(ev.createdAt).toLocaleString()}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-zinc-500">Sem eventos na linha do tempo.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
