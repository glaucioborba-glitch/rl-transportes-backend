"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/portal/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ApiError, aprovarSolicitacao, fetchSolicitacao, type SolicitacaoRow } from "@/lib/api/portal-client";
import { formatDateTime } from "@/lib/portal-tracking";
import { toast } from "@/lib/toast";
import { usePortalAuthStore } from "@/stores/portal-store";

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
  const [row, setRow] = useState<SolicitacaoRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [aproving, setAproving] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const s = await fetchSolicitacao(id);
        if (!cancelled) setRow(s);
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

  const p = row.portaria;

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">{row.protocolo}</h1>
          <p className="text-sm text-slate-400">
            Cliente · {row.cliente?.nome ?? "—"} · {formatDateTime(row.createdAt)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusBadge status={row.status} />
          {row.status === "PENDENTE" ? (
            <Button disabled={aproving} onClick={() => void onAprovar()}>
              {aproving ? "…" : "Aprovar"}
            </Button>
          ) : null}
          <Button variant="outline" asChild>
            <Link href="/portal/solicitacoes">Voltar</Link>
          </Button>
        </div>
      </div>

      <Tabs defaultValue="unidades" className="w-full">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="unidades">Unidades</TabsTrigger>
          <TabsTrigger value="eventos">Eventos</TabsTrigger>
          <TabsTrigger value="documentos">Documentos</TabsTrigger>
        </TabsList>

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
                      <span className="font-mono text-white">{u.numeroIso}</span>
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
                <CardTitle>Fotos (portaria)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <PhotoStrip title="Contêiner" urls={p.fotosContainer} />
                <PhotoStrip title="Cavalo" urls={p.fotosCaminhao} />
                <PhotoStrip title="Lacre" urls={p.fotosLacre} />
                <PhotoStrip title="Avarias" urls={p.fotosAvarias} />
              </CardContent>
            </Card>
          ) : null}
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
