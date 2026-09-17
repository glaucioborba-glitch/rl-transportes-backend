"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FileSpreadsheet, Search, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api/corporate-auth-client";
import {
  baixarModeloCatalogoContainers,
  importarCatalogoContainers,
  listSaasCatalogoContainers,
  type CatalogoContainersImportResultado,
} from "@/lib/api/super-admin-client";
import type { CatalogoContainerIso } from "@/lib/catalogo-container-iso";
import { toast } from "@/lib/toast";

function kg(n: number | null) {
  return n != null ? `${n} kg` : "—";
}

export default function SuperAdminCatalogoContainersPage() {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<CatalogoContainerIso[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [resultado, setResultado] = useState<CatalogoContainersImportResultado | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const reload = useCallback(async (busca?: string) => {
    setLoading(true);
    try {
      const r = await listSaasCatalogoContainers(busca);
      setItems(r.items);
      setTotal(r.total);
    } catch {
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void reload(q);
    }, q ? 300 : 0);
    return () => window.clearTimeout(t);
  }, [q, reload]);

  async function baixarModelo() {
    try {
      await baixarModeloCatalogoContainers();
      toast.success("Modelo baixado. Preencha e importe o .xls.");
    } catch {
      toast.error("Não foi possível baixar o modelo.");
    }
  }

  async function onArquivo(file: File | undefined) {
    if (!file) return;
    setImporting(true);
    try {
      const r = await importarCatalogoContainers(file);
      setResultado(r);
      const ok = r.criados + r.atualizados;
      if (ok) {
        toast.success(`${r.criados} nova(s), ${r.atualizados} atualizada(s).`);
      } else if (r.erros.length) {
        toast.error(r.erros[0]?.motivo ?? "Nenhuma linha importada.");
      } else {
        toast.error("Nenhuma linha válida na planilha.");
      }
      await reload(q);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Falha ao importar a planilha.");
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Catálogo de caixas</h2>
          <p className="text-sm text-zinc-400">
            ISO, tipo/tamanho, capacidade DC/HC (opcional) e pesos em kg — compartilhado entre todos
            os terminais. Sem cliente, booking ou lacre. A foto da placa no Gate confirma DC/HC.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => void baixarModelo()}>
            <FileSpreadsheet />
            Baixar modelo .xls
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={importing}
            onClick={() => fileRef.current?.click()}
          >
            <Upload />
            {importing ? "Importando…" : "Importar .xls"}
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".xls,.xlsx,.csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            onChange={(e) => void onArquivo(e.target.files?.[0])}
          />
        </div>
      </div>
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value.toUpperCase())}
          placeholder="Buscar ISO…"
          className="pl-9"
        />
      </div>
      <p className="text-xs text-zinc-500">{loading ? "Carregando…" : `${total} caixa(s)`}</p>
      {resultado?.erros.length ? (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
          {resultado.erros.length} linha(s) com erro
          {resultado.duplicadosNaPlanilha
            ? ` · ${resultado.duplicadosNaPlanilha} ISO(s) repetido(s) na planilha (vale a última)`
            : ""}
          <ul className="mt-1 max-h-32 overflow-auto font-mono text-xs">
            {resultado.erros.slice(0, 20).map((e) => (
              <li key={`${e.linha}-${e.iso}`}>
                L{e.linha} {e.iso || "—"} — {e.motivo}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="overflow-x-auto rounded-lg border border-white/10">
        <table className="w-full text-left text-sm">
          <thead className="bg-white/5 text-xs uppercase tracking-wide text-zinc-400">
            <tr>
              <th className="px-3 py-2 font-medium">ISO</th>
              <th className="px-3 py-2 font-medium">Cadastro</th>
              <th className="px-3 py-2 font-medium">Capacidade</th>
              <th className="px-3 py-2 font-medium">Tara</th>
              <th className="px-3 py-2 font-medium">MGW</th>
              <th className="px-3 py-2 font-medium">Payload</th>
            </tr>
          </thead>
          <tbody>
            {items.map((row) => (
              <tr key={row.unidadeIso} className="border-t border-white/10">
                <td className="px-3 py-2 font-mono text-white">{row.unidadeIso}</td>
                <td className="px-3 py-2 text-zinc-300">
                  {row.tipoCodigo && row.tamanhoPes
                    ? `${row.tipoCodigo} / ${row.tamanhoPes}'`
                    : row.tipoCodigo || (row.tamanhoPes ? `${row.tamanhoPes}'` : "—")}
                </td>
                <td className="px-3 py-2 text-zinc-300">{row.capacidade || "—"}</td>
                <td className="px-3 py-2 text-zinc-300">{kg(row.taraKg)}</td>
                <td className="px-3 py-2 text-zinc-300">{kg(row.mgwKg)}</td>
                <td className="px-3 py-2 text-zinc-300">{kg(row.payloadKg)}</td>
              </tr>
            ))}
            {!loading && items.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-zinc-500">
                  Nenhuma caixa no catálogo. Importe um .xls ou confirme no gate.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
