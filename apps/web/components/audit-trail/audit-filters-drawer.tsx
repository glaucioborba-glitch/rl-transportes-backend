"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AuditTrailQuery, CategoriaAuditLog } from "@/lib/api/audit-trail-client";

type Props = {
  open: boolean;
  filters: AuditTrailQuery;
  usuarios: { usuarioId: string; usuarioNome: string }[];
  acoes: string[];
  onChange: (next: AuditTrailQuery) => void;
  onClose: () => void;
  onApply: () => void;
  onClear: () => void;
};

export function AuditFiltersDrawer({
  open,
  filters,
  usuarios,
  acoes,
  onChange,
  onClose,
  onApply,
  onClear,
}: Props) {
  if (!open) return null;

  return (
    <>
      <button type="button" className="fixed inset-0 z-40 bg-black/60" aria-label="Fechar filtros" onClick={onClose} />
      <aside className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-zinc-800 bg-zinc-950 shadow-2xl">
        <header className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
          <h2 className="text-lg font-semibold text-white">Filtros avançados</h2>
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Fechar
          </Button>
        </header>
        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          <label className="block space-y-1 text-sm">
            <span className="text-zinc-400">Data inicial</span>
            <Input
              type="date"
              value={filters.dataInicio ?? ""}
              onChange={(e) => onChange({ ...filters, dataInicio: e.target.value || undefined })}
              className="border-zinc-700 bg-zinc-900"
            />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="text-zinc-400">Data final</span>
            <Input
              type="date"
              value={filters.dataFim ?? ""}
              onChange={(e) => onChange({ ...filters, dataFim: e.target.value || undefined })}
              className="border-zinc-700 bg-zinc-900"
            />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="text-zinc-400">Usuário</span>
            <select
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white"
              value={filters.usuarioId ?? ""}
              onChange={(e) => onChange({ ...filters, usuarioId: e.target.value || undefined })}
            >
              <option value="">Todos</option>
              {usuarios.map((u) => (
                <option key={u.usuarioId} value={u.usuarioId}>
                  {u.usuarioNome}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1 text-sm">
            <span className="text-zinc-400">Ação específica</span>
            <select
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white"
              value={filters.acao ?? ""}
              onChange={(e) => onChange({ ...filters, acao: e.target.value || undefined })}
            >
              <option value="">Todas</option>
              {acoes.map((a) => (
                <option key={a} value={a}>
                  {a.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1 text-sm">
            <span className="text-zinc-400">Contêiner (ISO)</span>
            <Input
              value={filters.containerIso ?? ""}
              onChange={(e) => onChange({ ...filters, containerIso: e.target.value || undefined })}
              placeholder="HLBU1234567"
              className="border-zinc-700 bg-zinc-900 font-mono uppercase"
            />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="text-zinc-400">Categoria</span>
            <select
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white"
              value={filters.categoria ?? ""}
              onChange={(e) =>
                onChange({ ...filters, categoria: (e.target.value as CategoriaAuditLog) || undefined })
              }
            >
              <option value="">Todas</option>
              <option value="OPERACIONAL">Operacional</option>
              <option value="FINANCEIRO">Financeiro</option>
              <option value="SEGURANCA">Segurança</option>
              <option value="SISTEMA">Sistema</option>
            </select>
          </label>
        </div>
        <footer className="flex gap-2 border-t border-zinc-800 p-5">
          <Button type="button" variant="outline" className="flex-1 border-zinc-700" onClick={onClear}>
            Limpar
          </Button>
          <Button type="button" className="flex-1 bg-emerald-600 hover:bg-emerald-500" onClick={onApply}>
            Aplicar
          </Button>
        </footer>
      </aside>
    </>
  );
}
