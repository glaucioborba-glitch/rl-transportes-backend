"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ExternalLink, Loader2, RefreshCw, Ship, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ApiError,
  staffGatePrevisaoNavios,
  type StaffPrevisaoNavios,
} from "@/lib/api/staff-client";

type ManobraRow = StaffPrevisaoNavios["manobrasPrevistas"][number];

type ManobraFiltros = {
  data: string;
  horario: string;
  manobra: string;
  berco: string;
  bordo: string;
  navio: string;
  rota: string;
  loa: string;
  boca: string;
  calado: string;
  situacao: string;
};

const MANOBRA_FILTROS_VAZIOS: ManobraFiltros = {
  data: "",
  horario: "",
  manobra: "",
  berco: "",
  bordo: "",
  navio: "",
  rota: "",
  loa: "",
  boca: "",
  calado: "",
  situacao: "",
};

const MANOBRA_FILTRO_CAMPOS: Array<{ key: keyof ManobraFiltros; label: string }> = [
  { key: "data", label: "Data" },
  { key: "horario", label: "Horário" },
  { key: "manobra", label: "Manobra" },
  { key: "berco", label: "Berço" },
  { key: "bordo", label: "Bordo" },
  { key: "navio", label: "Navio" },
  { key: "rota", label: "Rota" },
  { key: "loa", label: "Loa" },
  { key: "boca", label: "Boca" },
  { key: "calado", label: "Calado" },
  { key: "situacao", label: "Situação" },
];

function formatAtualizado(iso: string) {
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "medium",
      timeZone: "America/Sao_Paulo",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function matchesFiltro(value: string, filtro: string) {
  const q = filtro.trim().toLowerCase();
  if (!q) return true;
  return (value ?? "").toLowerCase().includes(q);
}

function filtrarManobras(rows: ManobraRow[], filtros: ManobraFiltros) {
  return rows.filter(
    (m) =>
      matchesFiltro(m.data, filtros.data) &&
      matchesFiltro(m.horario, filtros.horario) &&
      matchesFiltro(m.manobra, filtros.manobra) &&
      matchesFiltro(m.berco, filtros.berco) &&
      matchesFiltro(m.bordo, filtros.bordo) &&
      matchesFiltro(m.navio, filtros.navio) &&
      matchesFiltro(m.rota, filtros.rota) &&
      matchesFiltro(m.loa, filtros.loa) &&
      matchesFiltro(m.boca, filtros.boca) &&
      matchesFiltro(m.calado, filtros.calado) &&
      matchesFiltro(m.situacao, filtros.situacao),
  );
}

function EmptyRow({ colSpan }: { colSpan: number }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-3 py-6 text-center text-sm text-zinc-500">
        Nenhum registro no momento.
      </td>
    </tr>
  );
}

export default function PrevisaoNaviosPage() {
  const [data, setData] = useState<StaffPrevisaoNavios | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [erro, setErro] = useState("");
  const [filtrosManobra, setFiltrosManobra] = useState<ManobraFiltros>(MANOBRA_FILTROS_VAZIOS);

  const carregar = useCallback(async (force = false) => {
    if (force) setRefreshing(true);
    else setLoading(true);
    setErro("");
    try {
      const snap = await staffGatePrevisaoNavios(force);
      setData(snap);
    } catch (e) {
      setErro(
        e instanceof ApiError
          ? e.message
          : "Não foi possível carregar a previsão de navios.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void carregar(false);
    const id = window.setInterval(() => void carregar(false), 5 * 60 * 1000);
    return () => window.clearInterval(id);
  }, [carregar]);

  const manobrasFiltradas = data
    ? filtrarManobras(data.manobrasPrevistas, filtrosManobra)
    : [];
  const filtrosAtivos = Object.values(filtrosManobra).some((v) => v.trim());

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-1 flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/operador/gate/dashboard" className="hover:text-white">
            Gate CPO
          </Link>
          <span>/</span>
          <span>Previsão de chegada de navios</span>
        </div>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <Ship className="h-6 w-6 text-sky-400" />
              Previsão de chegada de navios
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Line-up do complexo Itajaí / Navegantes (fonte ZP21 Práticos). Atualização
              automática no servidor a cada ~10 minutos.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={loading || refreshing}
            onClick={() => void carregar(true)}
          >
            {refreshing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Atualizar agora
          </Button>
        </div>
      </div>

      {data ? (
        <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
          <span>
            Fonte:{" "}
            <a
              href={data.fonteUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-sky-400 hover:underline"
            >
              {data.fonte}
              <ExternalLink className="h-3 w-3" />
            </a>
          </span>
          <span>·</span>
          <span>Atualizado em {formatAtualizado(data.atualizadoEm)}</span>
          {data.stale ? (
            <Badge variant="outline" className="border-amber-500/40 text-amber-400">
              Cache desatualizado
            </Badge>
          ) : (
            <Badge variant="outline" className="border-emerald-500/40 text-emerald-400">
              Em dia
            </Badge>
          )}
        </div>
      ) : null}

      {erro ? (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {erro}
        </div>
      ) : null}

      {loading && !data ? (
        <div className="flex items-center gap-2 text-sm text-zinc-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando line-up…
        </div>
      ) : null}

      {data ? (
        <div className="space-y-8">
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-white">
                Manobras previstas{" "}
                <span className="text-sm font-normal text-zinc-500">
                  ({manobrasFiltradas.length}
                  {filtrosAtivos ? ` de ${data.manobrasPrevistas.length}` : ""})
                </span>
              </h2>
              {filtrosAtivos ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 text-zinc-400 hover:text-white"
                  onClick={() => setFiltrosManobra(MANOBRA_FILTROS_VAZIOS)}
                >
                  <X className="mr-1 h-3.5 w-3.5" />
                  Limpar filtros
                </Button>
              ) : null}
            </div>

            <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
              {MANOBRA_FILTRO_CAMPOS.map(({ key, label }) => (
                <label key={key} className="space-y-1">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                    {label}
                  </span>
                  <Input
                    value={filtrosManobra[key]}
                    onChange={(e) =>
                      setFiltrosManobra((prev) => ({ ...prev, [key]: e.target.value }))
                    }
                    placeholder={`Filtrar ${label.toLowerCase()}…`}
                    className="h-8 border-zinc-700 bg-zinc-900/60 text-sm"
                  />
                </label>
              ))}
            </div>

            <div className="overflow-x-auto rounded-md border border-zinc-800">
              <table className="w-full min-w-[1100px] text-left text-sm">
                <thead className="bg-zinc-900/80 text-xs uppercase text-zinc-400">
                  <tr>
                    <th className="px-3 py-2">Data</th>
                    <th className="px-3 py-2">Horário</th>
                    <th className="px-3 py-2">Manobra</th>
                    <th className="px-3 py-2">Berço</th>
                    <th className="px-3 py-2">Bordo</th>
                    <th className="px-3 py-2">Navio</th>
                    <th className="px-3 py-2">Rota</th>
                    <th className="px-3 py-2">Loa</th>
                    <th className="px-3 py-2">Boca</th>
                    <th className="px-3 py-2">Calado</th>
                    <th className="px-3 py-2">Situação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {manobrasFiltradas.length === 0 ? (
                    <EmptyRow colSpan={11} />
                  ) : (
                    manobrasFiltradas.map((m, i) => (
                      <tr
                        key={`${m.data}-${m.horario}-${m.navio}-${i}`}
                        className="hover:bg-zinc-900/50"
                      >
                        <td className="px-3 py-2 text-zinc-300">{m.data || "—"}</td>
                        <td className="px-3 py-2 text-zinc-300">{m.horario || "—"}</td>
                        <td className="px-3 py-2">
                          <Badge
                            variant="outline"
                            className={
                              m.manobra.toLowerCase().includes("entrada")
                                ? "border-emerald-500/40 text-emerald-300"
                                : "border-zinc-600 text-zinc-300"
                            }
                          >
                            {m.manobra || "—"}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 text-zinc-300">{m.berco || "—"}</td>
                        <td className="px-3 py-2 text-zinc-300">{m.bordo || "—"}</td>
                        <td className="px-3 py-2 font-medium text-white">{m.navio || "—"}</td>
                        <td className="px-3 py-2 text-zinc-400">{m.rota || "—"}</td>
                        <td className="px-3 py-2 text-zinc-300">{m.loa || "—"}</td>
                        <td className="px-3 py-2 text-zinc-300">{m.boca || "—"}</td>
                        <td className="px-3 py-2 text-zinc-300">{m.calado || "—"}</td>
                        <td className="px-3 py-2 text-zinc-400">{m.situacao || "—"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-white">
              Navios previstos{" "}
              <span className="text-sm font-normal text-zinc-500">({data.previstos.length})</span>
            </h2>
            <div className="overflow-x-auto rounded-md border border-zinc-800">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="bg-zinc-900/80 text-xs uppercase text-zinc-400">
                  <tr>
                    <th className="px-3 py-2">Navio</th>
                    <th className="px-3 py-2">Previsão de chegada</th>
                    <th className="px-3 py-2">Loa</th>
                    <th className="px-3 py-2">Calado</th>
                    <th className="px-3 py-2">Rota</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {data.previstos.length === 0 ? (
                    <EmptyRow colSpan={5} />
                  ) : (
                    data.previstos.map((n) => (
                      <tr key={`${n.navio}-${n.previsaoChegada}`} className="hover:bg-zinc-900/50">
                        <td className="px-3 py-2 font-medium text-white">{n.navio}</td>
                        <td className="px-3 py-2 text-sky-300">{n.previsaoChegada || "—"}</td>
                        <td className="px-3 py-2 text-zinc-300">{n.loa || "—"}</td>
                        <td className="px-3 py-2 text-zinc-300">{n.calado || "—"}</td>
                        <td className="px-3 py-2 text-zinc-400">{n.rota || "—"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="space-y-2">
              <h2 className="text-lg font-semibold text-white">
                Atracados{" "}
                <span className="text-sm font-normal text-zinc-500">({data.atracados.length})</span>
              </h2>
              <div className="overflow-x-auto rounded-md border border-zinc-800">
                <table className="w-full text-left text-sm">
                  <thead className="bg-zinc-900/80 text-xs uppercase text-zinc-400">
                    <tr>
                      <th className="px-3 py-2">Navio</th>
                      <th className="px-3 py-2">Berço</th>
                      <th className="px-3 py-2">Data/Hora</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {data.atracados.length === 0 ? (
                      <EmptyRow colSpan={3} />
                    ) : (
                      data.atracados.map((n) => (
                        <tr key={`${n.navio}-${n.dataHora}`} className="hover:bg-zinc-900/50">
                          <td className="px-3 py-2 font-medium text-white">{n.navio}</td>
                          <td className="px-3 py-2 text-zinc-300">{n.berco || "—"}</td>
                          <td className="px-3 py-2 text-zinc-400">{n.dataHora || "—"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-semibold text-white">
                Fundeados{" "}
                <span className="text-sm font-normal text-zinc-500">({data.fundeados.length})</span>
              </h2>
              <div className="overflow-x-auto rounded-md border border-zinc-800">
                <table className="w-full text-left text-sm">
                  <thead className="bg-zinc-900/80 text-xs uppercase text-zinc-400">
                    <tr>
                      <th className="px-3 py-2">Navio</th>
                      <th className="px-3 py-2">Posição</th>
                      <th className="px-3 py-2">Data/Hora</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {data.fundeados.length === 0 ? (
                      <EmptyRow colSpan={3} />
                    ) : (
                      data.fundeados.map((n) => (
                        <tr key={`${n.navio}-${n.dataHora}`} className="hover:bg-zinc-900/50">
                          <td className="px-3 py-2 font-medium text-white">{n.navio}</td>
                          <td className="px-3 py-2 text-zinc-300">{n.posicao || "—"}</td>
                          <td className="px-3 py-2 text-zinc-400">{n.dataHora || "—"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </div>
      ) : null}
    </div>
  );
}
