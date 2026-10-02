"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, Search, Ship } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SectionTitle } from "@/components/portal/portal-primitives";
import { PortalTable } from "@/components/portal/portal-table";
import { Skeleton } from "@/components/ui/skeleton";
import { ContainerNumber } from "@/components/ui/container-number";
import {
  ApiError,
  fetchPatioSaldo,
  type CampoEmbarquePatio,
  type PortalPatioSaldoItem,
  type PortalPatioSaldoResponse,
} from "@/lib/api/portal-client";
import { toast } from "@/lib/toast";
import { PatioIdLink } from "@/components/portal/patio-id-link";
import { ConsultaEstoqueSubnav } from "@/components/portal/consulta-estoque-subnav";
import {
  EditarEmbarqueDialog,
  EmbarqueEditButton,
} from "@/components/portal/editar-embarque-dialog";
import {
  patioCargaLabel,
  patioDataAgendamentoLabel,
  patioEquipamentoLabel,
  patioHoraJanelaLabel,
  patioSaldoMatchesQuery,
} from "@/lib/portal-patio-display";
import { DEFAULT_PERMISSOES, usePessoaPermissoesStore } from "@/stores/pessoaPermissoesStore";

const CELL = "whitespace-nowrap px-2.5 py-2 text-sm";
const SEM_NAVIO = "Sem navio";

function navioKey(item: PortalPatioSaldoItem): string {
  return item.navio?.trim() || SEM_NAVIO;
}

function sortEmbarque(a: PortalPatioSaldoItem, b: PortalPatioSaldoItem): number {
  const booking = (a.booking ?? "").localeCompare(b.booking ?? "", "pt-BR", { sensitivity: "base" });
  if (booking !== 0) return booking;
  const processo = (a.processo ?? "").localeCompare(b.processo ?? "", "pt-BR", { sensitivity: "base" });
  if (processo !== 0) return processo;
  const id = (a.unidadeProcessoLabel ?? "").localeCompare(b.unidadeProcessoLabel ?? "", "pt-BR", {
    numeric: true,
  });
  if (id !== 0) return id;
  return a.unidadeIso.localeCompare(b.unidadeIso, "pt-BR");
}

function groupByNavio(items: PortalPatioSaldoItem[]): { navio: string; items: PortalPatioSaldoItem[] }[] {
  const map = new Map<string, PortalPatioSaldoItem[]>();
  for (const item of items) {
    const key = navioKey(item);
    const list = map.get(key) ?? [];
    list.push(item);
    map.set(key, list);
  }
  const keys = [...map.keys()].sort((a, b) => {
    if (a === SEM_NAVIO) return 1;
    if (b === SEM_NAVIO) return -1;
    return a.localeCompare(b, "pt-BR", { sensitivity: "base" });
  });
  return keys.map((navio) => ({
    navio,
    items: (map.get(navio) ?? []).slice().sort(sortEmbarque),
  }));
}

function EmbarqueValor({
  valor,
  onEdit,
}: {
  valor: string;
  onEdit?: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="max-w-[12rem] truncate text-slate-200">{valor || "—"}</span>
      {onEdit ? <EmbarqueEditButton onClick={onEdit} /> : null}
    </div>
  );
}

function EmbarqueCells({
  r,
  keyName,
  onEdit,
}: {
  r: PortalPatioSaldoItem;
  keyName: string;
  onEdit?: (campo: CampoEmbarquePatio) => void;
}) {
  if (keyName === "id") return <PatioIdLink item={r} />;
  if (keyName === "unidade") {
    return <ContainerNumber value={r.unidadeIso} showLabel={false} size="sm" />;
  }
  if (keyName === "tipo") {
    return <span className="text-slate-200">{patioEquipamentoLabel(r)}</span>;
  }
  if (keyName === "carga") return patioCargaLabel(r.statusContainer);
  if (keyName === "booking") {
    return <EmbarqueValor valor={r.booking?.trim() || ""} onEdit={onEdit ? () => onEdit("booking") : undefined} />;
  }
  if (keyName === "processo") {
    return <EmbarqueValor valor={r.processo?.trim() || ""} onEdit={onEdit ? () => onEdit("processo") : undefined} />;
  }
  if (keyName === "navio") {
    return <EmbarqueValor valor={r.navio?.trim() || ""} onEdit={onEdit ? () => onEdit("navio") : undefined} />;
  }
  if (keyName === "localDestino") {
    return (
      <EmbarqueValor
        valor={r.localDestino?.trim() || ""}
        onEdit={onEdit ? () => onEdit("localDestino") : undefined}
      />
    );
  }
  if (keyName === "dataAgendamento") {
    return (
      <EmbarqueValor
        valor={patioDataAgendamentoLabel(r.dataAgendamento)}
        onEdit={onEdit ? () => onEdit("dataAgendamento") : undefined}
      />
    );
  }
  if (keyName === "horaJanela") {
    return (
      <EmbarqueValor
        valor={patioHoraJanelaLabel(r.horaInicio, r.horaFim)}
        onEdit={onEdit ? () => onEdit("horaJanela") : undefined}
      />
    );
  }
  return null;
}

const COLUMNS = [
  { key: "id", header: "ID", className: CELL },
  { key: "unidade", header: "Unidade", className: CELL },
  { key: "tipo", header: "Tipo", className: CELL },
  { key: "carga", header: "Carga", className: CELL },
  { key: "booking", header: "Booking", className: CELL },
  { key: "processo", header: "Processo", className: CELL },
  { key: "navio", header: "Navio", className: CELL },
  { key: "localDestino", header: "Local de destino", className: CELL },
  { key: "dataAgendamento", header: "Data", className: CELL },
  { key: "horaJanela", header: "Hora", className: CELL },
];

export default function OrganizadorEmbarquePage() {
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [data, setData] = useState<PortalPatioSaldoResponse | null>(null);
  const [edit, setEdit] = useState<{ item: PortalPatioSaldoItem; campo: CampoEmbarquePatio } | null>(
    null,
  );
  const podeEditar =
    usePessoaPermissoesStore((s) => s.permissoes)?.podeVerOS ?? DEFAULT_PERMISSOES.podeVerOS;

  const abrirEdicao = useCallback(
    (item: PortalPatioSaldoItem, campo: CampoEmbarquePatio) => {
      if (!podeEditar) return;
      if (!item.solicitacaoId) {
        toast.error("Esta unidade não tem solicitação vinculada para editar.");
        return;
      }
      setEdit({ item, campo });
    },
    [podeEditar],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await fetchPatioSaldo());
    } catch (e) {
      toast.error(
        e instanceof ApiError ? e.message : "Não foi possível carregar o organizador de embarque",
      );
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const items = data?.items ?? [];
    return items.filter((item) => patioSaldoMatchesQuery(item, query));
  }, [data, query]);

  const grupos = useMemo(() => groupByNavio(filtered), [filtered]);

  if (loading && !data) {
    return (
      <main className="mx-auto w-[90%] px-4 py-8">
        <Skeleton className="h-40 w-full" />
      </main>
    );
  }

  if (!data) {
    return (
      <main className="mx-auto w-[90%] space-y-6 px-4 py-8">
        <SectionTitle
          title="Consulta de estoque"
          description="ID, unidade, tipo, carga, booking, processo, navio, destino, data e hora das unidades depositadas."
        />
        <div className="mb-2">
          <ConsultaEstoqueSubnav />
        </div>
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <p className="text-sm text-slate-400">Não foi possível carregar o organizador de embarque.</p>
            <Button variant="outline" size="sm" onClick={() => void load()}>
              Tentar novamente
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  const total = data.total;

  return (
    <main className="mx-auto w-[90%] space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <SectionTitle
          className="mb-0"
          title="Consulta de estoque"
          description="ID, unidade, tipo, carga, booking, processo, navio, destino, data e hora das unidades depositadas."
        />
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      <ConsultaEstoqueSubnav />

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar ID, unidade, booking, processo ou navio"
          className="pl-9"
          aria-label="Buscar unidades no organizador de embarque"
        />
      </div>

      {total === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-slate-400">
            Nenhuma unidade depositada no pátio no momento.
          </CardContent>
        </Card>
      ) : grupos.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-slate-400">
            Nenhuma unidade encontrada com a busca atual.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {grupos.map((grupo) => (
            <section key={grupo.navio} className="space-y-3">
              <div className="flex items-center gap-2">
                <Ship className="h-4 w-4 text-[var(--accent)]" aria-hidden />
                <h3 className="text-sm font-semibold text-white">{grupo.navio}</h3>
                <span className="text-xs text-slate-500">
                  {grupo.items.length} {grupo.items.length === 1 ? "unidade" : "unidades"}
                </span>
              </div>

              <div className="hidden md:block">
                <Card>
                  <CardContent className="p-0">
                    <PortalTable
                      columns={COLUMNS}
                      rows={grupo.items}
                      getRowKey={(r) => r.id}
                      emptyText="Nenhuma unidade neste navio."
                      renderCell={(r, key) => (
                        <EmbarqueCells
                          r={r}
                          keyName={key}
                          onEdit={podeEditar ? (campo) => abrirEdicao(r, campo) : undefined}
                        />
                      )}
                    />
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-3 md:hidden">
                {grupo.items.map((r) => (
                  <Card key={r.id} className="transition-colors hover:border-white/20">
                    <CardContent className="space-y-3 py-4">
                      <div className="min-w-0 space-y-1">
                        <PatioIdLink item={r} />
                        <ContainerNumber value={r.unidadeIso} showLabel={false} size="md" />
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <p className="text-xs text-slate-500">Tipo</p>
                          <p className="text-slate-200">{patioEquipamentoLabel(r)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Carga</p>
                          <p className="text-slate-200">{patioCargaLabel(r.statusContainer)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Booking</p>
                          <EmbarqueValor
                            valor={r.booking?.trim() || ""}
                            onEdit={podeEditar ? () => abrirEdicao(r, "booking") : undefined}
                          />
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Processo</p>
                          <EmbarqueValor
                            valor={r.processo?.trim() || ""}
                            onEdit={podeEditar ? () => abrirEdicao(r, "processo") : undefined}
                          />
                        </div>
                        <div className="col-span-2">
                          <p className="text-xs text-slate-500">Navio</p>
                          <EmbarqueValor
                            valor={r.navio?.trim() || ""}
                            onEdit={podeEditar ? () => abrirEdicao(r, "navio") : undefined}
                          />
                        </div>
                        <div className="col-span-2">
                          <p className="text-xs text-slate-500">Local de destino</p>
                          <EmbarqueValor
                            valor={r.localDestino?.trim() || ""}
                            onEdit={podeEditar ? () => abrirEdicao(r, "localDestino") : undefined}
                          />
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Data</p>
                          <EmbarqueValor
                            valor={patioDataAgendamentoLabel(r.dataAgendamento)}
                            onEdit={podeEditar ? () => abrirEdicao(r, "dataAgendamento") : undefined}
                          />
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Hora</p>
                          <EmbarqueValor
                            valor={patioHoraJanelaLabel(r.horaInicio, r.horaFim)}
                            onEdit={podeEditar ? () => abrirEdicao(r, "horaJanela") : undefined}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <EditarEmbarqueDialog
        open={Boolean(edit)}
        item={edit?.item ?? null}
        campo={edit?.campo ?? null}
        onClose={() => setEdit(null)}
        onSaved={() => void load()}
      />
    </main>
  );
}
