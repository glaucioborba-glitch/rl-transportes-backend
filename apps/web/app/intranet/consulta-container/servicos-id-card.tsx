"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, Trash2, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api/staff-client";
import {
  lancarUnidadeProcessoServico,
  listCatalogoServicosAtivos,
  listUnidadeProcessoServicos,
  removerUnidadeProcessoServico,
  type CadastroServicoItem,
} from "@/lib/api/cadastros-tabelas-servicos-client";
import { toast } from "@/lib/toast";

function money(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function ServicosIdCard({
  unidadeProcessoId,
  numero,
}: {
  unidadeProcessoId: string;
  numero: number;
}) {
  const [catalogo, setCatalogo] = useState<CadastroServicoItem[]>([]);
  const [lancados, setLancados] = useState<
    Array<{ id: string; codigo: string; nome: string; quantidade: number; valorTotal: number }>
  >([]);
  const [servicoItemId, setServicoItemId] = useState("");
  const [quantidade, setQuantidade] = useState("1");
  const [lacre, setLacre] = useState("");
  const [origemLacre, setOrigemLacre] = useState("CLIENTE");
  const [isoDestino, setIsoDestino] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const selecionado = catalogo.find((s) => s.id === servicoItemId);
  const efeito = selecionado?.efeito ?? "NENHUM";

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const [cat, rows] = await Promise.all([
        listCatalogoServicosAtivos(),
        listUnidadeProcessoServicos(unidadeProcessoId),
      ]);
      setCatalogo(cat.items);
      setLancados(rows.items);
      setServicoItemId((prev) => prev || cat.items[0]?.id || "");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Falha ao carregar serviços do ID");
    } finally {
      setLoading(false);
    }
  }, [unidadeProcessoId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function lancar(e: React.FormEvent) {
    e.preventDefault();
    const qtd = Number(quantidade.replace(",", "."));
    if (!servicoItemId || !Number.isFinite(qtd) || qtd <= 0) {
      toast.error("Escolha o serviço e a quantidade.");
      return;
    }
    setSaving(true);
    try {
      await lancarUnidadeProcessoServico(unidadeProcessoId, {
        servicoItemId,
        quantidade: qtd,
        ...(efeito === "SUBSTITUIR_LACRE_SAIDA" ? { lacre, origemLacre } : {}),
        ...(efeito === "TRANSBORDO_CARGA" ? { isoDestino, lacre: lacre || undefined } : {}),
      });
      toast.success("Serviço lançado na fatura do pátio.");
      setLacre("");
      setIsoDestino("");
      await carregar();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao lançar.");
    } finally {
      setSaving(false);
    }
  }

  async function remover(lancamentoId: string) {
    setSaving(true);
    try {
      await removerUnidadeProcessoServico(unidadeProcessoId, lancamentoId);
      toast.success("Lançamento removido.");
      await carregar();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao remover.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="border-white/10 bg-[#0b101c]/80">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base text-white">
          <Wrench className="h-4 w-4 text-cyan-300" />
          Serviços no ID {numero}
        </CardTitle>
        <CardDescription className="text-zinc-500">
          Entram na mesma fatura do pátio (lavagem, lacre, pesagem…). Valores vêm da tabela padrão de serviços.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm text-zinc-200">
        {loading ? <div className="h-16 animate-pulse rounded-md bg-white/5" /> : null}

        {!loading ? (
          <form onSubmit={(e) => void lancar(e)} className="flex flex-wrap items-end gap-3">
            <label className="min-w-[14rem] flex-1 space-y-1">
              <span className="text-xs text-zinc-400">Serviço</span>
              <select
                className="h-10 w-full rounded-md border border-zinc-600 bg-black/40 px-3 text-sm text-white"
                value={servicoItemId}
                onChange={(e) => setServicoItemId(e.target.value)}
              >
                {catalogo.length === 0 ? <option value="">Nenhum serviço cadastrado</option> : null}
                {catalogo.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.codigo} — {s.nome} ({money(s.valor)})
                  </option>
                ))}
              </select>
            </label>
            <label className="w-24 space-y-1">
              <span className="text-xs text-zinc-400">Qtd</span>
              <Input
                value={quantidade}
                onChange={(e) => setQuantidade(e.target.value)}
                inputMode="decimal"
                className="border-zinc-600 bg-black/40 text-white"
              />
            </label>
            {efeito === "SUBSTITUIR_LACRE_SAIDA" ? (
              <>
                <label className="w-40 space-y-1">
                  <span className="text-xs text-zinc-400">Novo lacre</span>
                  <Input
                    value={lacre}
                    onChange={(e) => setLacre(e.target.value)}
                    className="border-zinc-600 bg-black/40 text-white"
                  />
                </label>
                <label className="min-w-[14rem] flex-1 space-y-1">
                  <span className="text-xs text-zinc-400">Origem do lacre</span>
                  <select
                    className="h-10 w-full rounded-md border border-zinc-600 bg-black/40 px-3 text-sm text-white"
                    value={origemLacre}
                    onChange={(e) => setOrigemLacre(e.target.value)}
                  >
                    <option value="CLIENTE">Fornecido pelo cliente (sem custo)</option>
                    <option value="TERMINAL">Retirado pela RL (com custo)</option>
                    <option value="PROVISORIO">Lacre provisório (sem custo)</option>
                  </select>
                </label>
              </>
            ) : null}
            {efeito === "TRANSBORDO_CARGA" ? (
              <>
                <p className="w-full text-xs text-zinc-500">
                  A e B precisam já estar armazenadas no pátio (ID aberto). O sistema não cria unidade nova.
                </p>
                <label className="min-w-[12rem] flex-1 space-y-1">
                  <span className="text-xs text-zinc-400">ISO destino (B)</span>
                  <Input
                    value={isoDestino}
                    onChange={(e) => setIsoDestino(e.target.value.toUpperCase())}
                    placeholder="ISO de B — já no pátio"
                    className="border-zinc-600 bg-black/40 font-mono text-white"
                  />
                </label>
                <label className="w-40 space-y-1">
                  <span className="text-xs text-zinc-400">Lacre (opcional)</span>
                  <Input
                    value={lacre}
                    onChange={(e) => setLacre(e.target.value)}
                    className="border-zinc-600 bg-black/40 text-white"
                  />
                </label>
              </>
            ) : null}
            <Button type="submit" size="sm" disabled={saving || !catalogo.length} className="bg-cyan-700 hover:bg-cyan-600">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              Lançar
            </Button>
          </form>
        ) : null}

        {!loading && lancados.length === 0 ? (
          <p className="text-zinc-500">Nenhum serviço lançado neste ID.</p>
        ) : null}

        {!loading && lancados.length > 0 ? (
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/10 text-xs text-zinc-500">
                <th className="py-2">Código</th>
                <th>Nome</th>
                <th>Qtd</th>
                <th>Total</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {lancados.map((row) => (
                <tr key={row.id} className="border-b border-white/5">
                  <td className="py-2 font-mono">{row.codigo}</td>
                  <td>{row.nome}</td>
                  <td>{row.quantidade}</td>
                  <td>{money(row.valorTotal)}</td>
                  <td className="text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={saving}
                      onClick={() => void remover(row.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </CardContent>
    </Card>
  );
}
