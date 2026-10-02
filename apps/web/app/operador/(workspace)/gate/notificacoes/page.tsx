"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Bell, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";
import { ApiError } from "@/lib/api/staff-client";
import {
  fetchGateNotificacoes,
  marcarGateNotificacaoLida,
  marcarTodasGateNotificacoesLidas,
  type GateUnidadeNotificacao,
} from "@/lib/gate/operacao-api";
import { formatIsoDisplay } from "@/lib/container-display";

function formatWhen(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export default function GateNotificacoesPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<GateUnidadeNotificacao[]>([]);
  const [action, setAction] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await fetchGateNotificacoes());
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Não foi possível carregar as notificações.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onLer(row: GateUnidadeNotificacao) {
    if (row.lidaEm) return;
    try {
      const atual = await marcarGateNotificacaoLida(row.id);
      setRows((prev) => prev.map((r) => (r.id === row.id ? atual : r)));
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Não foi possível marcar como lida.");
    }
  }

  async function onLerTodas() {
    setAction(true);
    try {
      await marcarTodasGateNotificacoesLidas();
      await load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Não foi possível atualizar as notificações.");
    } finally {
      setAction(false);
    }
  }

  const naoLidas = rows.filter((r) => !r.lidaEm).length;

  return (
    <div className="space-y-5 p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Notificações</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Qualquer alteração na unidade depois da criação do ID (baixa confirmada) — portal do
            cliente ou correção no Gate.
          </p>
        </div>
        {naoLidas > 0 ? (
          <Button type="button" variant="outline" size="sm" disabled={action} onClick={() => void onLerTodas()}>
            Marcar todas como lidas
          </Button>
        ) : null}
      </div>

      {loading ? (
        <div className="flex min-h-[30vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : rows.length === 0 ? (
        <div className="flex items-center gap-3 rounded-lg border border-border px-4 py-10 text-sm text-muted-foreground">
          <Bell className="h-5 w-5 shrink-0" aria-hidden />
          Nenhuma alteração nas unidades com ID no momento.
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => {
            const unread = !row.lidaEm;
            return (
              <li key={row.id}>
                <div
                  className={cn(
                    "rounded-lg border border-border bg-card p-4",
                    unread && "border-orange-500/40 bg-orange-500/5",
                  )}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold">{row.titulo}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatWhen(row.criadoEm)} · {formatIsoDisplay(row.unidadeIso)} ·{" "}
                        {row.origem === "PORTAL" ? "Portal do cliente" : "Gate"}
                      </p>
                    </div>
                    {unread ? (
                      <span className="rounded-full bg-orange-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                        Nova
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                    {row.corpo}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" asChild>
                      <Link href={row.href} onClick={() => void onLer(row)}>
                        Abrir ID
                      </Link>
                    </Button>
                    {unread ? (
                      <Button type="button" variant="ghost" size="sm" onClick={() => void onLer(row)}>
                        Marcar como lida
                      </Button>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
