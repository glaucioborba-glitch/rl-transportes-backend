"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FileSpreadsheet, Search, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api/corporate-auth-client";
import {
  baixarModeloCatalogoNavios,
  importarCatalogoNavios,
  listSaasCatalogoNavios,
  type CatalogoNavio,
  type CatalogoNaviosImportResultado,
} from "@/lib/api/super-admin-client";
import { toast } from "@/lib/toast";

const ORIGEM: Record<string, string> = {
  IMPORT: "Planilha",
  SOLICITACAO: "Solicitação",
  GATE: "Processo / gate",
};

export default function SuperAdminCatalogoNaviosPage() {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<CatalogoNavio[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [resultado, setResultado] = useState<CatalogoNaviosImportResultado | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const reload = useCallback(async (busca?: string) => {
    setLoading(true);
    try {
      const r = await listSaasCatalogoNavios(busca);
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
      await baixarModeloCatalogoNavios();
      toast.success("Modelo baixado. Preencha e importe o .xls.");
    } catch {
      toast.error("Não foi possível baixar o modelo.");
    }
  }

  async function onArquivo(file: File | undefined) {
    if (!file) return;
    setImporting(true);
    try {
      const r = await importarCatalogoNavios(file);
      setResultado(r);
      const ok = r.criados + r.atualizados;
      if (ok) {
        toast.success(`${r.criados} nova(s), ${r.atualizados} já no catálogo.`);
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
          <h2 className="text-lg font-semibold text-white">Catálogo de navios</h2>
          <p className="text-sm text-zinc-400">
            Somente o nome — compartilhado entre todos os terminais, para auto completar nas
            solicitações e no gate. Sem duplicata (caixa e acento não criam outro navio). Nomes
            novos nas solicitações ou processos entram nesta lista.
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
          placeholder="Buscar navio…"
          className="pl-9"
        />
      </div>
      <p className="text-xs text-zinc-500">{loading ? "Carregando…" : `${total} navio(s)`}</p>
      {resultado?.erros.length ? (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
          {resultado.erros.length} linha(s) com erro
          {resultado.duplicadosNaPlanilha
            ? ` · ${resultado.duplicadosNaPlanilha} nome(s) repetido(s) na planilha (vale a última)`
            : ""}
          <ul className="mt-1 max-h-32 overflow-auto font-mono text-xs">
            {resultado.erros.slice(0, 20).map((e) => (
              <li key={`${e.linha}-${e.nome}`}>
                L{e.linha} {e.nome || "—"} — {e.motivo}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="overflow-x-auto rounded-lg border border-white/10">
        <table className="w-full text-left text-sm">
          <thead className="bg-white/5 text-xs uppercase tracking-wide text-zinc-400">
            <tr>
              <th className="px-3 py-2 font-medium">Navio</th>
              <th className="px-3 py-2 font-medium">Origem</th>
            </tr>
          </thead>
          <tbody>
            {items.map((row) => (
              <tr key={row.nome} className="border-t border-white/10">
                <td className="px-3 py-2 font-medium text-white">{row.nome}</td>
                <td className="px-3 py-2 text-zinc-300">{ORIGEM[row.origem] ?? row.origem}</td>
              </tr>
            ))}
            {!loading && items.length === 0 ? (
              <tr>
                <td colSpan={2} className="px-3 py-8 text-center text-zinc-500">
                  Nenhum navio no catálogo. Importe um .xls ou grave o nome numa solicitação.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
