"use client";

import { useMemo, useState } from "react";
import { FileDown, FileText, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ContainerNumber } from "@/components/ui/container-number";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { StaffPatioSaldoFiltro } from "@/lib/api/staff-client";
import type { GatePatioUnidade } from "@/lib/gate/gate-cockpit-types";
import { TomadaGateCard } from "@/components/gate/tomada-gate-card";

type FiltroTipo = "TODOS" | "REEFER" | "DRY";
type FiltroBaia = "TODAS" | "SEM" | "COM";

type Props = {
  ocupados: number;
  capacidade: number;
  reefers: number;
  semBaia: number;
  unidades: GatePatioUnidade[];
  exporting?: boolean;
  onExportPdf?: (filtro: StaffPatioSaldoFiltro) => void;
  onExportXml?: (filtro: StaffPatioSaldoFiltro) => void;
  onTomadaChanged?: () => void;
};

function rotuloSituacao(situacao?: string): string {
  if (situacao === "CHEIO") return "Cheio";
  if (situacao === "VAZIO") return "Vazio";
  return situacao?.trim() || "—";
}

export function GatePatioPanel({
  ocupados,
  capacidade,
  reefers,
  semBaia,
  unidades,
  exporting,
  onExportPdf,
  onExportXml,
  onTomadaChanged,
}: Props) {
  const [busca, setBusca] = useState("");
  const [isoTomada, setIsoTomada] = useState<string | null>(null);
  const [filtroTipo, setFiltroTipo] = useState<FiltroTipo>("TODOS");
  const [filtroDias, setFiltroDias] = useState(false);
  const [filtroSituacao, setFiltroSituacao] = useState("TODOS");
  const [filtroTamanho, setFiltroTamanho] = useState("TODOS");
  const [filtroBaia, setFiltroBaia] = useState<FiltroBaia | string>("TODAS");
  const [filtroCliente, setFiltroCliente] = useState("TODOS");

  const clientes = useMemo(() => {
    return [...new Set(unidades.map((u) => u.cliente).filter((c) => c && c !== "—"))].sort((a, b) =>
      a.localeCompare(b, "pt-BR"),
    );
  }, [unidades]);

  const baias = useMemo(() => {
    return [...new Set(unidades.map((u) => u.posicao).filter((p) => p && p !== "—"))].sort((a, b) =>
      a.localeCompare(b, "pt-BR"),
    );
  }, [unidades]);

  const tamanhos = useMemo(() => {
    return [...new Set(unidades.map((u) => u.tamanho).filter(Boolean))].sort((a, b) =>
      Number(a) - Number(b) || String(a).localeCompare(String(b)),
    );
  }, [unidades]);

  const rows = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return unidades.filter((u) => {
      if (filtroTipo === "REEFER" && !u.refrigerado) return false;
      if (filtroTipo === "DRY" && u.refrigerado) return false;
      if (filtroDias && u.diasNoPatio <= 3) return false;
      if (filtroSituacao !== "TODOS" && u.situacao !== filtroSituacao) return false;
      if (filtroTamanho !== "TODOS" && u.tamanho !== filtroTamanho) return false;
      if (filtroBaia === "SEM" && u.posicao !== "—") return false;
      if (filtroBaia === "COM" && u.posicao === "—") return false;
      if (filtroBaia !== "TODAS" && filtroBaia !== "SEM" && filtroBaia !== "COM" && u.posicao !== filtroBaia) {
        return false;
      }
      if (filtroCliente !== "TODOS" && u.cliente !== filtroCliente) return false;
      if (q) {
        const blob = [
          u.container,
          u.cliente,
          u.processo,
          u.booking,
          u.navio,
          u.posicao,
          u.situacao,
          rotuloSituacao(u.situacao),
          u.tamanho,
          u.tamanhoLabel,
          u.processoNumero != null ? `ID ${u.processoNumero}` : "",
        ]
          .join(" ")
          .toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });
  }, [unidades, busca, filtroTipo, filtroDias, filtroSituacao, filtroTamanho, filtroBaia, filtroCliente]);

  const filtroExport: StaffPatioSaldoFiltro = {
    q: busca.trim() || undefined,
    tipo: filtroTipo,
    diasMin: filtroDias ? 4 : undefined,
    situacao: filtroSituacao !== "TODOS" ? filtroSituacao : undefined,
    tamanho: filtroTamanho !== "TODOS" ? filtroTamanho : undefined,
    baia: filtroBaia !== "TODAS" ? filtroBaia : undefined,
    cliente: filtroCliente !== "TODOS" ? filtroCliente : undefined,
  };

  const filtrosAtivos =
    Boolean(busca.trim()) ||
    filtroTipo !== "TODOS" ||
    filtroDias ||
    filtroSituacao !== "TODOS" ||
    filtroTamanho !== "TODOS" ||
    filtroBaia !== "TODAS" ||
    filtroCliente !== "TODOS";

  function limparFiltros() {
    setBusca("");
    setFiltroTipo("TODOS");
    setFiltroDias(false);
    setFiltroSituacao("TODOS");
    setFiltroTamanho("TODOS");
    setFiltroBaia("TODAS");
    setFiltroCliente("TODOS");
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4 rounded-lg border border-white/10 bg-[#0b1018]/80 px-4 py-3">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-zinc-500">Saldo</p>
          <p className="text-2xl font-semibold text-white">
            {ocupados}
            <span className="text-lg text-zinc-500">/{capacidade || "—"}</span>
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-zinc-500">Reefers</p>
          <p className="text-xl font-semibold text-sky-300">{reefers}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-zinc-500">Sem baia</p>
          <p className="text-xl font-semibold text-zinc-200">{semBaia}</p>
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={exporting}
            onClick={() => onExportPdf?.(filtroExport)}
          >
            <FileText className="mr-1.5 h-4 w-4" />
            PDF
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={exporting}
            onClick={() => onExportXml?.(filtroExport)}
          >
            <FileDown className="mr-1.5 h-4 w-4" />
            XML
          </Button>
        </div>
      </div>

      <div className="space-y-3 rounded-lg border border-white/10 bg-[#0b1018]/60 px-4 py-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar ISO, cliente, processo, booking, navio, ID ou baia"
            className="pl-9"
            aria-label="Buscar unidades"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(["TODOS", "REEFER", "DRY"] as FiltroTipo[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFiltroTipo(f)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium",
                filtroTipo === f ? "bg-white/15 text-white" : "text-zinc-500 hover:text-white",
              )}
            >
              {f === "TODOS" ? "Todos" : f === "REEFER" ? "Reefer" : "Dry"}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setFiltroDias((v) => !v)}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-medium",
              filtroDias ? "bg-amber-500/20 text-amber-100" : "text-zinc-500 hover:text-white",
            )}
          >
            &gt;3 dias
          </button>
          <select
            value={filtroSituacao}
            onChange={(e) => setFiltroSituacao(e.target.value)}
            className="h-8 rounded-md border border-white/10 bg-black/40 px-2 text-xs text-zinc-200"
            aria-label="Filtrar por situação"
          >
            <option value="TODOS">Situação</option>
            <option value="CHEIO">Cheio</option>
            <option value="VAZIO">Vazio</option>
          </select>
          <select
            value={filtroTamanho}
            onChange={(e) => setFiltroTamanho(e.target.value)}
            className="h-8 rounded-md border border-white/10 bg-black/40 px-2 text-xs text-zinc-200"
            aria-label="Filtrar por tamanho"
          >
            <option value="TODOS">Tamanho</option>
            {tamanhos.map((t) => (
              <option key={t} value={t}>
                {t}'
              </option>
            ))}
          </select>
          <select
            value={filtroBaia}
            onChange={(e) => setFiltroBaia(e.target.value)}
            className="h-8 rounded-md border border-white/10 bg-black/40 px-2 text-xs text-zinc-200"
            aria-label="Filtrar por baia"
          >
            <option value="TODAS">Baia (todas)</option>
            <option value="SEM">Sem baia</option>
            <option value="COM">Com baia</option>
            {baias.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
          <select
            value={filtroCliente}
            onChange={(e) => setFiltroCliente(e.target.value)}
            className="h-8 rounded-md border border-white/10 bg-black/40 px-2 text-xs text-zinc-200"
            aria-label="Filtrar por cliente"
          >
            <option value="TODOS">Cliente</option>
            {clientes.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          {filtrosAtivos ? (
            <button type="button" onClick={limparFiltros} className="text-xs text-zinc-400 hover:text-white">
              Limpar filtros
            </button>
          ) : null}
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-white/10">
        <table className="w-max min-w-full text-left text-xs">
          <thead className="border-b border-white/10 bg-white/[0.03] text-[10px] uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="whitespace-nowrap px-2.5 py-2">Contêiner</th>
              <th className="whitespace-nowrap px-2.5 py-2">ID</th>
              <th className="whitespace-nowrap px-2.5 py-2">Tipo</th>
              <th className="whitespace-nowrap px-2.5 py-2">Situação</th>
              <th className="whitespace-nowrap px-2.5 py-2">Tam.</th>
              <th className="whitespace-nowrap px-2.5 py-2">Baia</th>
              <th className="whitespace-nowrap px-2.5 py-2">Entrada</th>
              <th className="whitespace-nowrap px-2.5 py-2">Dias</th>
              <th className="whitespace-nowrap px-2.5 py-2">Cliente</th>
              <th className="whitespace-nowrap px-2.5 py-2">Processo</th>
              <th className="whitespace-nowrap px-2.5 py-2">Booking</th>
              <th className="whitespace-nowrap px-2.5 py-2">Navio</th>
              <th className="whitespace-nowrap px-2.5 py-2">Tomada</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr
                key={u.unidadeId}
                className={cn(
                  "border-b border-white/5 hover:bg-white/[0.02]",
                  u.diasNoPatio > 3 && "bg-amber-500/[0.06]",
                  isoTomada === u.container && "bg-cyan-500/10",
                )}
              >
                <td className="whitespace-nowrap px-2.5 py-1.5">
                  <ContainerNumber value={u.container} showLabel={false} size="sm" />
                </td>
                <td className="whitespace-nowrap px-2.5 py-1.5 font-mono text-zinc-300">
                  {u.processoNumero != null ? `ID ${u.processoNumero}` : "—"}
                </td>
                <td className="whitespace-nowrap px-2.5 py-1.5">
                  <Badge variant="neutral" className={u.refrigerado ? "border-sky-500/40 text-sky-200" : ""}>
                    {u.tipo}
                  </Badge>
                </td>
                <td className="whitespace-nowrap px-2.5 py-1.5 text-zinc-300">{rotuloSituacao(u.situacao)}</td>
                <td className="whitespace-nowrap px-2.5 py-1.5 font-mono text-zinc-300">
                  {u.tamanhoLabel || (u.tamanho ? `${u.tamanho}'` : "—")}
                </td>
                <td className="whitespace-nowrap px-2.5 py-1.5 font-mono text-zinc-300">{u.posicao}</td>
                <td className="whitespace-nowrap px-2.5 py-1.5 text-zinc-400">
                  {new Date(u.entradaEm).toLocaleDateString("pt-BR")}
                </td>
                <td className="whitespace-nowrap px-2.5 py-1.5">
                  <span className={cn("font-semibold", u.diasNoPatio > 3 ? "text-amber-300" : "text-zinc-300")}>
                    {u.diasNoPatio}
                  </span>
                </td>
                <td className="whitespace-nowrap px-2.5 py-1.5 text-zinc-200">{u.cliente}</td>
                <td className="whitespace-nowrap px-2.5 py-1.5 font-mono text-zinc-300">{u.processo || "—"}</td>
                <td className="whitespace-nowrap px-2.5 py-1.5 font-mono text-zinc-300">{u.booking || "—"}</td>
                <td className="whitespace-nowrap px-2.5 py-1.5 text-zinc-300">{u.navio || "—"}</td>
                <td className="whitespace-nowrap px-2.5 py-1.5">
                  {u.tomadaReefer || u.refrigerado ? (
                  <button
                    type="button"
                    className={cn(
                      "rounded px-2 py-0.5 text-[11px] font-medium",
                      u.refrigerado
                        ? "bg-emerald-500/15 text-emerald-200"
                        : "bg-white/5 text-zinc-400 hover:text-white",
                    )}
                    onClick={() => setIsoTomada(u.container)}
                  >
                    {u.refrigerado ? "Ligada" : "Ligar"}
                  </button>
                  ) : (
                    <span className="text-zinc-600">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length ? (
          <p className="py-8 text-center text-sm text-zinc-500">
            {unidades.length
              ? "Nenhuma unidade com os filtros atuais."
              : "Nenhuma unidade armazenada no terminal."}
          </p>
        ) : (
          <p className="px-3 py-2 text-xs text-zinc-500">
            {rows.length} de {unidades.length} unidade{unidades.length === 1 ? "" : "s"}
          </p>
        )}
      </div>

      {isoTomada ? (
        <TomadaGateCard
          unidadeIso={isoTomada}
          onChanged={() => {
            onTomadaChanged?.();
          }}
        />
      ) : (
        <p className="text-xs text-zinc-500">
          Clique em Ligar/Ligada para conectar ou desconectar a tomada no Gate. A diária começa no instante da conexão.
        </p>
      )}
    </div>
  );
}
