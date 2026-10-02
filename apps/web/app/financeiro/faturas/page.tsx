"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { ApiError } from "@/lib/api/staff-client";
import {
  listarFilaFaturas,
  type FaturaFilaCliente,
  type FaturaPacoteEnviada,
} from "@/lib/api/fatura-pacote-client";
import { formatCpfCnpjBr } from "@/lib/format-cpf-cnpj-br";
import { formatBRL } from "@/lib/financeiro/format";
import {
  formatDataHoraBr,
  labelModoFatura,
  labelStatusFatura,
} from "@/lib/financeiro/fatura-pacote-display";
import { isIntranetGestorRole } from "@/lib/intranet/intranet-path-access";
import { useStaffAuthStore } from "@/stores/staff-auth-store";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function FinanceiroFaturasPage() {
  const user = useStaffAuthStore((s) => s.user);
  const ok = isIntranetGestorRole(user?.role);
  const [busca, setBusca] = useState("");
  const [clientes, setClientes] = useState<FaturaFilaCliente[]>([]);
  const [enviadas, setEnviadas] = useState<FaturaPacoteEnviada[]>([]);
  const [loading, setLoading] = useState(false);

  const carregar = useCallback(async () => {
    if (!ok) return;
    setLoading(true);
    try {
      const out = await listarFilaFaturas();
      setClientes(out.clientes);
      setEnviadas(out.enviadas);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível carregar as Faturas.");
    } finally {
      setLoading(false);
    }
  }, [ok]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return clientes;
    return clientes.filter((c) => {
      const nome = `${c.razaoSocial} ${c.nomeFantasia ?? ""} ${c.cpfCnpj}`.toLowerCase();
      return nome.includes(q);
    });
  }, [busca, clientes]);

  if (!ok) {
    return (
      <div>
        <p className="text-amber-400">Área restrita a gestão (ADMIN / GERENTE).</p>
      </div>
    );
  }

  return (
    <div className="min-w-0 max-w-full space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Faturas</h1>
        <p className="mt-1 max-w-3xl text-sm text-zinc-400">
          Cada Fatura (<span className="font-mono text-zinc-300">FAT-…</span>) é um pacote de um
          cliente: IDs encerrados + demonstrativo + uma NFS-e e boleto ou PIX. O ID entra inteiro.
          A composição (diárias, serviços, extras) aparece na ficha do cliente. Modo e hora ficam em{" "}
          <Link href="/financeiro/condicoes-clientes" className="text-sky-400 underline-offset-2 hover:underline">
            Forma e prazo
          </Link>
          .
        </p>
      </div>

      <Card className="min-w-0 border-zinc-800 bg-zinc-950/80">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-base text-zinc-100">A faturar</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar empresa ou CNPJ"
              className="max-w-xs"
              aria-label="Buscar cliente"
            />
            <Button type="button" variant="outline" size="sm" onClick={() => void carregar()}>
              Atualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent className="min-w-0">
          {loading && clientes.length === 0 ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : filtrados.length === 0 ? (
            <p className="text-sm text-zinc-500">Nenhum ID encerrado aguardando Fatura.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase text-zinc-500">
                  <tr>
                    <th className="py-2 pr-3 font-medium">Cliente</th>
                    <th className="py-2 pr-3 font-medium">Modo</th>
                    <th className="py-2 pr-3 font-medium">IDs</th>
                    <th className="py-2 pr-3 text-right font-medium">Total</th>
                    <th className="py-2 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {filtrados.map((row) => (
                    <tr key={row.id} className="border-t border-zinc-800">
                      <td className="py-3 pr-3">
                        <p className="font-medium text-zinc-200">{row.razaoSocial}</p>
                        {row.nomeFantasia ? (
                          <p className="text-xs text-zinc-500">{row.nomeFantasia}</p>
                        ) : null}
                        <p className="font-mono text-xs text-zinc-400">{formatCpfCnpjBr(row.cpfCnpj)}</p>
                      </td>
                      <td className="py-3 pr-3 text-zinc-300">
                        {labelModoFatura(row.faturamentoModo, row.faturamentoHora)}
                      </td>
                      <td className="py-3 pr-3 text-zinc-300">{row.ids.length}</td>
                      <td className="py-3 pr-3 text-right font-medium text-zinc-100">
                        {formatBRL(row.total)}
                      </td>
                      <td className="py-3 text-right">
                        <Button asChild size="sm">
                          <Link href={`/financeiro/faturas/${row.id}`}>Abrir IDs</Link>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="min-w-0 border-zinc-800 bg-zinc-950/80">
        <CardHeader>
          <CardTitle className="text-base text-zinc-100">Emitidas e agendadas</CardTitle>
        </CardHeader>
        <CardContent>
          {enviadas.length === 0 ? (
            <p className="text-sm text-zinc-500">Nenhuma Fatura emitida ainda.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase text-zinc-500">
                  <tr>
                    <th className="py-2 pr-3 font-medium">Fatura</th>
                    <th className="py-2 pr-3 font-medium">Cliente</th>
                    <th className="py-2 pr-3 font-medium">Status</th>
                    <th className="py-2 pr-3 text-right font-medium">Valor</th>
                    <th className="py-2 pr-3 font-medium">Emissão</th>
                    <th className="py-2 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {enviadas.map((row) => (
                    <tr key={row.id} className="border-t border-zinc-800">
                      <td className="py-3 pr-3 font-mono text-zinc-200">{row.numero}</td>
                      <td className="py-3 pr-3 text-zinc-300">{row.clienteNome}</td>
                      <td className="py-3 pr-3 text-zinc-300">{labelStatusFatura(row.status)}</td>
                      <td className="py-3 pr-3 text-right text-zinc-100">{formatBRL(row.valorTotal)}</td>
                      <td className="py-3 pr-3 text-zinc-400">
                        {row.status === "RASCUNHO"
                          ? `Agendada ${formatDataHoraBr(row.agendadoPara)}`
                          : formatDataHoraBr(row.dataEmissao)}
                      </td>
                      <td className="py-3 text-right">
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/financeiro/faturas/pacote/${row.id}`}>Ver composição</Link>
                        </Button>
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
