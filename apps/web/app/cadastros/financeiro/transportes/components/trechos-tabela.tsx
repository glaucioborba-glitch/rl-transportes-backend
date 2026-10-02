"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Copy, Edit2, Plus, Route, Search, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWidgetData, WidgetError } from "@/components/ui/widget-error";
import { ApiError } from "@/lib/api/staff-client";
import {
  deleteCadastroTarifaTransporte,
  listCadastrosTarifasTransporte,
  type CadastroTarifaTransporte,
} from "@/lib/api/cadastros-tarifas-transporte-client";
import { formatBRL } from "@/lib/financeiro/format";
import { toast } from "@/lib/toast";

function LoadingSkeleton() {
  return <div className="h-64 animate-pulse rounded-lg border border-border bg-card" />;
}

type Props = {
  tabelaId: string;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
};

export function TrechosTabela({ tabelaId, canCreate, canEdit, canDelete }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const { data, loading, error, refetch } = useWidgetData(
    () => listCadastrosTarifasTransporte(tabelaId, search),
    [tabelaId, search],
  );
  const tarifas = useMemo(() => data?.items ?? [], [data?.items]);

  async function onExcluir(tarifa: CadastroTarifaTransporte) {
    if (
      !window.confirm(
        `Excluir o trecho ${tarifa.trecho} (${tarifa.statusCarga === "VAZIO" ? "vazio" : "cheio"} · ${tarifa.tipoContainerNome}${tarifa.retorno ? " · retorno" : ""})?`,
      )
    ) {
      return;
    }
    try {
      await deleteCadastroTarifaTransporte(tarifa.id);
      toast.success("Trecho excluído.");
      refetch();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível excluir.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Trechos</h2>
          <p className="text-sm text-muted-foreground">
            Trecho bidirecional, cheio/vazio, tipo de contêiner e retorno (50%).
          </p>
        </div>
        {canCreate ? (
          <Button
            variant="default"
            size="sm"
            onClick={() =>
              router.push(`/cadastros/financeiro/transportes/${tabelaId}/trechos/novo`)
            }
          >
            <Plus className="mr-2 h-4 w-4" />
            Novo trecho
          </Button>
        ) : null}
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por trecho, carga ou tipo..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {loading ? <LoadingSkeleton /> : null}
      {!loading && error ? (
        <WidgetError title="Não foi possível carregar trechos" onRetry={refetch} />
      ) : null}

      {!loading && !error ? (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <table className="w-full">
            <thead className="border-b border-border">
              <tr className="text-xs uppercase tracking-wider text-muted-foreground">
                <th className="p-4 text-left">Trecho</th>
                <th className="p-4 text-left">Carga</th>
                <th className="p-4 text-left">Tipo</th>
                <th className="p-4 text-center">Retorno</th>
                <th className="p-4 text-right">Tarifa</th>
                <th className="p-4 text-right">Cobrado</th>
                <th className="p-4 text-right">Terceiro</th>
                <th className="p-4 text-center">Status</th>
                <th className="p-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody>
              {tarifas.map((tarifa) => (
                <tr key={tarifa.id} className="border-b border-border/50 hover:bg-muted/20">
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <Route className="h-4 w-4 shrink-0 text-muted-foreground" />
                      {tarifa.retorno ? (
                        <Badge
                          variant="neutral"
                          className="border-amber-500/30 bg-amber-500/15 text-amber-300"
                        >
                          Retorno
                        </Badge>
                      ) : null}
                      <span className="font-medium">{tarifa.trecho}</span>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {tarifa.localA.codigo} ↔ {tarifa.localB.codigo}
                      {tarifa.observacao ? ` · ${tarifa.observacao}` : ""}
                    </p>
                  </td>
                  <td className="p-4 text-sm">{tarifa.statusCarga === "VAZIO" ? "Vazio" : "Cheio"}</td>
                  <td className="p-4 text-sm">
                    <span className="font-medium">{tarifa.tipoContainerNome}</span>
                    <span className="mt-0.5 block font-mono text-xs text-muted-foreground">
                      {tarifa.tipoContainerCodigo}
                    </span>
                  </td>
                  <td className="p-4 text-center">
                    {tarifa.retorno ? (
                      <Badge
                        variant="neutral"
                        className="border-amber-500/30 bg-amber-500/15 text-amber-300"
                      >
                        50%
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">Não</span>
                    )}
                  </td>
                  <td className="p-4 text-right font-mono tabular-nums">{formatBRL(tarifa.valor)}</td>
                  <td className="p-4 text-right font-mono tabular-nums">{formatBRL(tarifa.valorCobrado)}</td>
                  <td className="p-4 text-right font-mono text-sm tabular-nums text-muted-foreground">
                    {tarifa.valorPagoTerceiroEfetivo != null
                      ? formatBRL(tarifa.valorPagoTerceiroEfetivo)
                      : tarifa.valorPagoTerceiro != null
                        ? formatBRL(tarifa.valorPagoTerceiro)
                        : "—"}
                  </td>
                  <td className="p-4 text-center">
                    <Badge
                      variant="neutral"
                      className={
                        tarifa.ativo
                          ? "border-green-500/30 bg-green-500/15 text-green-400"
                          : "border-red-500/30 bg-red-500/15 text-red-400"
                      }
                    >
                      {tarifa.ativo ? "Ativo" : "Inativo"}
                    </Badge>
                  </td>
                  <td className="p-4 text-center">
                    <div className="flex items-center justify-center gap-1">
                      {canEdit ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label="Editar"
                          onClick={() =>
                            router.push(
                              `/cadastros/financeiro/transportes/${tabelaId}/trechos/${tarifa.id}`,
                            )
                          }
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                      ) : null}
                      {canCreate ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label="Duplicar"
                          title="Duplicar trecho"
                          onClick={() =>
                            router.push(
                              `/cadastros/financeiro/transportes/${tabelaId}/trechos/novo?duplicar=${encodeURIComponent(tarifa.id)}`,
                            )
                          }
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      ) : null}
                      {canDelete ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-400 hover:text-red-300"
                          aria-label="Excluir"
                          onClick={() => void onExcluir(tarifa)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {tarifas.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">
              Nenhum trecho nesta tabela. Os pontos de origem e destino ficam em{" "}
              <Link
                href="/cadastros/operacional/origens-destinos"
                className="text-[var(--accent)] hover:underline"
              >
                Origens e destinos
              </Link>
              .
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
