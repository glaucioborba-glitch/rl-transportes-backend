"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SectionTitle } from "@/components/portal/portal-primitives";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import {
  ApiError,
  fetchPortalNotificacoes,
  marcarPortalNotificacaoLida,
  marcarTodasPortalNotificacoesLidas,
  type PortalNotificacao,
} from "@/lib/api/portal-client";
import { notifyPortalNotificacoesChanged } from "@/hooks/use-portal-notificacoes-unread";

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString("pt-BR");
  } catch {
    return iso;
  }
}

export default function PortalNotificacoesPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<PortalNotificacao[]>([]);
  const [action, setAction] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await fetchPortalNotificacoes());
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Não foi possível carregar as notificações.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onLer(row: PortalNotificacao) {
    if (row.lidaEm) return;
    try {
      const atual = await marcarPortalNotificacaoLida(row.id);
      setRows((prev) => prev.map((r) => (r.id === row.id ? atual : r)));
      notifyPortalNotificacoesChanged();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Não foi possível marcar como lida.");
    }
  }

  async function onLerTodas() {
    setAction(true);
    try {
      await marcarTodasPortalNotificacoesLidas();
      await load();
      notifyPortalNotificacoesChanged();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Não foi possível atualizar as notificações.");
    } finally {
      setAction(false);
    }
  }

  if (loading) {
    return (
      <main className="mx-auto w-[90%] px-4 py-8">
        <Skeleton className="h-40 w-full" />
      </main>
    );
  }

  const naoLidas = rows.filter((r) => !r.lidaEm).length;

  return (
    <main className="mx-auto w-[90%] space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <SectionTitle
          className="mb-0"
          title="Notificações"
          description="Comunicados da área financeira sobre o seu cadastro e a condição comercial vigente."
        />
        {naoLidas > 0 ? (
          <Button type="button" variant="outline" size="sm" disabled={action} onClick={() => void onLerTodas()}>
            Marcar todas como lidas
          </Button>
        ) : null}
      </div>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="flex items-center gap-3 py-10 text-sm text-muted-foreground">
            <Bell className="h-5 w-5 shrink-0" aria-hidden />
            Nenhuma notificação no momento.
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => {
            const unread = !row.lidaEm;
            return (
              <li key={row.id}>
                <Card className={cn(unread && "border-sky-500/40 bg-sky-950/30")}>
                  <CardContent className="space-y-3 py-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-white">{row.titulo}</p>
                        <p className="text-xs text-zinc-500">{formatWhen(row.createdAt)}</p>
                      </div>
                      {unread ? (
                        <span className="rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                          Nova
                        </span>
                      ) : null}
                    </div>
                    <p className="whitespace-pre-line text-sm leading-relaxed text-zinc-300">{row.corpo}</p>
                    <div className="flex flex-wrap gap-2">
                      {row.link ? (
                        <Button variant="outline" size="sm" asChild>
                          <Link href={row.link} onClick={() => void onLer(row)}>
                            Abrir
                          </Link>
                        </Button>
                      ) : null}
                      {unread ? (
                        <Button type="button" variant="ghost" size="sm" onClick={() => void onLer(row)}>
                          Marcar como lida
                        </Button>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
