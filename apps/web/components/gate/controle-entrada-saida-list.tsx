"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { GATE_POLLING_INTERVAL_MS } from "@/lib/dev-performance";
import {
  fetchControleEntradaSaida,
  type ControleColuna,
  type OperacaoDto,
} from "@/lib/gate/operacao-api";
import { toast } from "@/lib/toast";

const COLUNAS: Array<{ id: ControleColuna | "TODAS"; label: string }> = [
  { id: "TODAS", label: "Todas" },
  { id: "A_CONFERIR", label: "A conferir" },
  { id: "RIC_PENDENTE", label: "RIC pendente" },
  { id: "NA_PORTARIA", label: "Na portaria" },
  { id: "LIBERADO", label: "Liberado hoje" },
];

const COLUNA_BADGE: Record<ControleColuna, { label: string; className: string }> = {
  A_CONFERIR: {
    label: "A conferir",
    className: "border-amber-500/30 bg-amber-500/15 text-amber-400",
  },
  RIC_PENDENTE: {
    label: "RIC pendente",
    className: "border-sky-500/30 bg-sky-500/15 text-sky-300",
  },
  NA_PORTARIA: {
    label: "Na portaria",
    className: "border-white/15 bg-white/5 text-slate-300",
  },
  LIBERADO: {
    label: "Liberado",
    className: "border-emerald-500/30 bg-emerald-500/15 text-emerald-300",
  },
};

function countByColuna(items: OperacaoDto[], coluna: ControleColuna) {
  return items.filter((i) => i.coluna === coluna).length;
}

export function ControleEntradaSaidaList() {
  const [items, setItems] = useState<OperacaoDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<ControleColuna | "TODAS">("A_CONFERIR");

  async function load(silent = false) {
    if (!silent) setLoading(true);
    try {
      const res = await fetchControleEntradaSaida();
      setItems(res.items ?? []);
    } catch (e) {
      if (!silent) toast.error(e instanceof Error ? e.message : "Falha ao carregar a fila.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(true), GATE_POLLING_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, []);

  const filtrados = useMemo(() => {
    if (filtro === "TODAS") return items;
    return items.filter((i) => i.coluna === filtro);
  }, [items, filtro]);

  const aConferir = countByColuna(items, "A_CONFERIR");
  const visiveis =
    filtro === "A_CONFERIR" && aConferir === 0 && items.length > 0 ? items : filtrados;
  const mostrandoTodasPorVazio = filtro === "A_CONFERIR" && aConferir === 0 && items.length > 0;

  if (loading && items.length === 0) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Controle de Entrada e Saída</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Conferência da solicitação com o que a portaria capturou. O Gate valida e emite a RIC.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="A conferir" value={aConferir} />
        <Kpi label="RIC pendente" value={countByColuna(items, "RIC_PENDENTE")} />
        <Kpi label="Na portaria" value={countByColuna(items, "NA_PORTARIA")} />
        <Kpi label="Liberado hoje" value={countByColuna(items, "LIBERADO")} />
      </div>

      <div className="flex flex-wrap gap-2">
        {COLUNAS.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setFiltro(c.id)}
            className={`rounded-md border px-3 py-1.5 text-xs font-medium ${
              filtro === c.id
                ? "border-primary/40 bg-primary/15 text-primary"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {mostrandoTodasPorVazio ? (
        <p className="text-sm text-muted-foreground">
          Nenhuma unidade aguardando conferência. Mostrando a fila completa.
        </p>
      ) : null}

      {visiveis.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhuma unidade nesta etapa. Quando a portaria concluir a vistoria, ela aparece aqui.
        </p>
      ) : (
        <ul className="space-y-3">
          {visiveis.map((op) => {
            const col = op.coluna ? COLUNA_BADGE[op.coluna] : null;
            const divergentes = op.conferencia?.resumo.divergentes ?? 0;
            return (
              <li key={op.protocolo}>
                <Link
                  href={`/operador/gate/controle-entrada-saida/${encodeURIComponent(op.protocolo)}`}
                  className="flex items-center justify-between gap-4 rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/30"
                >
                  <div className="min-w-0">
                    <p className="font-bold">{op.protocolo}</p>
                    <p className="truncate text-sm text-muted-foreground">
                      {op.containerNumero} · {op.placa} · {op.clienteNome}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {op.tipoOperacaoLabel ?? op.tipoOperacao}
                      {op.fotosCount ? ` · ${op.fotosCount} foto(s)` : ""}
                    </p>
                    {divergentes > 0 ? (
                      <p className="mt-1 flex items-center gap-1 text-xs text-red-400">
                        <AlertTriangle className="h-3 w-3" />
                        {divergentes} divergência(s) solicitação × portaria
                      </p>
                    ) : null}
                    {op.devolucaoPortaria ? (
                      <p className="mt-1 text-xs text-orange-300">
                        Devolvida à portaria — complementar vistoria
                      </p>
                    ) : null}
                    {(op.avariasCount ?? 0) > 0 ? (
                      <p className="mt-1 flex items-center gap-1 text-xs text-amber-400">
                        <AlertTriangle className="h-3 w-3" />
                        {op.avariasCount} avaria(s) na vistoria
                      </p>
                    ) : null}
                  </div>
                  {col ? (
                    <Badge variant="neutral" className={`shrink-0 ${col.className}`}>
                      {col.label}
                    </Badge>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}
