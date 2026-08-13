"use client";

import { useCallback, useEffect, useState } from "react";
import { UploadCloud } from "lucide-react";
import {
  fetchCnabArquivos,
  uploadCnabRetorno,
  type ArquivoBancarioRow,
  type ArquivoBancarioStatus,
} from "@/lib/api/cnab-client";
import { ApiError } from "@/lib/api/staff-client";
import { toast } from "@/lib/toast";
import { useStaffAuthStore } from "@/stores/staff-auth-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function statusBadge(status: ArquivoBancarioStatus) {
  const map: Record<ArquivoBancarioStatus, { label: string; className: string }> = {
    PENDENTE: { label: "Pendente", className: "bg-zinc-700 text-zinc-200" },
    PROCESSANDO: { label: "Processando", className: "bg-amber-500/20 text-amber-200" },
    CONCLUIDO: { label: "Concluído", className: "bg-emerald-500/20 text-emerald-200" },
    ERRO: { label: "Erro", className: "bg-red-500/20 text-red-200" },
  };
  const s = map[status];
  return (
    <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", s.className)}>{s.label}</span>
  );
}

function formatDt(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

export default function ConciliacaoBancariaPage() {
  const ok = useStaffAuthStore((s) => s.user?.role === "ADMIN" || s.user?.role === "GERENTE");
  const [arquivos, setArquivos] = useState<ArquivoBancarioRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const load = useCallback(async () => {
    if (!ok) return;
    setLoading(true);
    try {
      const rows = await fetchCnabArquivos();
      setArquivos(rows);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Erro ao carregar histórico CNAB");
    } finally {
      setLoading(false);
    }
  }, [ok]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleFile(file: File | null | undefined) {
    if (!file || uploading) return;
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!["txt", "ret"].includes(ext)) {
      toast.error("Use arquivos .txt ou .RET de retorno bancário.");
      return;
    }
    setUploading(true);
    try {
      const row = await uploadCnabRetorno(file);
      toast.success(row.resumo ?? "Arquivo processado.");
      await load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Falha no upload CNAB");
    } finally {
      setUploading(false);
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    void handleFile(file);
  }

  if (!ok) {
    return <p className="text-amber-400">Somente gestão (ADMIN / GERENTE).</p>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Conciliação Bancária</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Importe arquivos de retorno CNAB (.txt / .RET) para baixa automática de faturas e desbloqueio financeiro.
        </p>
      </div>

      <Card className="border-zinc-800 bg-zinc-900/70">
        <CardHeader>
          <CardTitle className="text-lg text-white">Upload de retorno</CardTitle>
        </CardHeader>
        <CardContent>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            className={cn(
              "flex min-h-[180px] flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 transition-colors",
              dragOver ? "border-emerald-400 bg-emerald-500/10" : "border-zinc-700 bg-zinc-950/50",
            )}
          >
            <UploadCloud className="h-10 w-10 text-zinc-500" />
            <p className="text-center text-sm text-zinc-400">
              Arraste e solte o arquivo <span className="font-mono text-zinc-200">.RET</span> ou{" "}
              <span className="font-mono text-zinc-200">.txt</span> aqui
            </p>
            <label className="cursor-pointer">
              <input
                type="file"
                accept=".txt,.ret,.RET"
                className="hidden"
                disabled={uploading}
                onChange={(e) => void handleFile(e.target.files?.[0])}
              />
              <Button type="button" variant="outline" className="min-h-11 border-zinc-600" asChild>
                <span>{uploading ? "Processando…" : "Selecionar arquivo"}</span>
              </Button>
            </label>
          </div>
        </CardContent>
      </Card>

      <Card className="border-zinc-800 bg-zinc-900/70">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg text-white">Histórico de processamento</CardTitle>
          <Button type="button" variant="outline" size="sm" className="border-zinc-700" onClick={() => void load()}>
            Atualizar
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-zinc-500">Carregando…</p>
          ) : arquivos.length === 0 ? (
            <p className="text-sm text-zinc-500">Nenhum arquivo processado ainda.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-500">
                    <th className="pb-2 pr-4 font-medium">Arquivo</th>
                    <th className="pb-2 pr-4 font-medium">Upload</th>
                    <th className="pb-2 pr-4 font-medium">Status</th>
                    <th className="pb-2 font-medium">Resumo</th>
                  </tr>
                </thead>
                <tbody>
                  {arquivos.map((a) => (
                    <tr key={a.id} className="border-b border-zinc-800/80">
                      <td className="py-3 pr-4 font-mono text-xs text-zinc-200">{a.nomeArquivo}</td>
                      <td className="py-3 pr-4 text-zinc-400">{formatDt(a.dataUpload)}</td>
                      <td className="py-3 pr-4">{statusBadge(a.status)}</td>
                      <td className="py-3 text-zinc-300">
                        {a.resumo ??
                          a.logProcessamento?.resumo ??
                          (a.status === "CONCLUIDO" ? "Processado" : "—")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
