"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { SolicitacaoRow } from "@/lib/api/portal-client";
import { formatDateTime } from "@/lib/portal-tracking";
import { formatContainerISO } from "@/utils/containerFormatter";
import { PreFaturaCustosCard } from "@/components/portal/pre-fatura-custos-card";

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

function Step({ label, done, detail }: { label: string; done: boolean; detail?: string }) {
  return (
    <div className="flex gap-3 border-l border-white/10 pl-4">
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

export function SolicitacaoDetailPanel({ row }: { row: SolicitacaoRow }) {
  const isCorporativa = Boolean(row.transporteSolicitacao);
  const p = row.portaria;

  return (
    <Tabs defaultValue={isCorporativa ? "corporativa" : "unidades"} className="w-full">
      <TabsList className="w-full justify-start overflow-x-auto">
        {isCorporativa ? <TabsTrigger value="corporativa">Dados da solicitação</TabsTrigger> : null}
        <TabsTrigger value="unidades">Unidades</TabsTrigger>
        <TabsTrigger value="eventos">Eventos</TabsTrigger>
        <TabsTrigger value="custos">Custos</TabsTrigger>
        <TabsTrigger value="documentos">Documentos</TabsTrigger>
      </TabsList>

      {isCorporativa ? (
        <TabsContent value="corporativa" className="mt-4 space-y-4">
          {row.transporteSolicitacao ? (
            <Card className="border-white/10 bg-black/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Transporte</CardTitle>
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
            <Card className="border-white/10 bg-black/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Contêineres</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {(row.containersSolicitacao ?? []).map((c) => (
                  <div key={c.id} className="rounded-lg border border-white/10 bg-black/30 p-3 text-sm">
                    <p className="font-mono text-base font-bold text-[var(--accent)]">
                      {formatContainerISO(c.unidade) || c.unidade}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">Unidade #{c.ordem}</p>
                    <p className="text-slate-400">
                      {c.booking} · {c.status}
                      {c.refrigerado ? ` · reefer ${c.setPoint ?? "—"}°C` : ""}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}
          {row.agendamentoSolicitacao ? (
            <Card className="border-white/10 bg-black/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Agendamento</CardTitle>
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
              </CardContent>
            </Card>
          ) : null}
          {(row.anexosSolicitacao?.length ?? 0) > 0 ? (
            <Card className="border-white/10 bg-black/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Anexos</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {(row.anexosSolicitacao ?? []).map((a) => (
                  <div key={a.id} className="flex flex-wrap justify-between gap-2 border-b border-white/5 py-2">
                    <span className="text-white">{a.filename}</span>
                    <span className="text-slate-500">{(a.size / 1024).toFixed(0)} KB</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}
        </TabsContent>
      ) : null}

      <TabsContent value="unidades" className="mt-4 space-y-4">
        <Card className="border-white/10 bg-black/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Contêineres</CardTitle>
            <CardDescription>ISO e tipo vinculados à solicitação.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {(row.unidades ?? []).length ? (
              (row.unidades ?? []).map((u) => (
                <div
                  key={u.id}
                  className="flex flex-col gap-2 rounded-lg border border-white/10 bg-black/30 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <span className="font-mono text-base font-bold text-[var(--accent)]">
                      {formatContainerISO(u.numeroIso) || u.numeroIso}
                    </span>
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
          <Card className="border-white/10 bg-black/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Fotos (portaria)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <PhotoStrip title="Contêiner" urls={p.fotosContainer} />
              <PhotoStrip title="Cavalo" urls={p.fotosCaminhao} />
            </CardContent>
          </Card>
        ) : null}
      </TabsContent>

      <TabsContent value="eventos" className="mt-4">
        <Card className="border-white/10 bg-black/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Ciclo operacional</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Step label="Portaria" done={!!row.portaria} detail={phaseDetail(row.portaria)} />
            <Step label="Gate" done={!!row.gate} detail={phaseDetail(row.gate)} />
            <Step label="Pátio" done={!!row.patio} detail={phaseDetail(row.patio)} />
            <Step label="Saída" done={!!row.saida} detail={phaseDetail(row.saida)} />
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="custos" className="mt-4 space-y-4">
        {[
          ...(row.containersSolicitacao ?? []).map((c) => c.unidade),
          ...(row.unidades ?? []).map((u) => u.numeroIso),
        ]
          .filter(Boolean)
          .filter((v, i, a) => a.indexOf(v) === i)
          .map((iso) => (
            <PreFaturaCustosCard key={iso} iso={iso} />
          ))}
        {!(row.containersSolicitacao?.length || row.unidades?.length) ? (
          <Card className="border-white/10 bg-black/20">
            <CardContent className="py-8 text-center text-sm text-slate-500">
              Nenhum contêiner vinculado para exibir custos.
            </CardContent>
          </Card>
        ) : null}
      </TabsContent>

      <TabsContent value="documentos" className="mt-4">
        <Card className="border-white/10 bg-black/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Documentos</CardTitle>
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
  );
}
