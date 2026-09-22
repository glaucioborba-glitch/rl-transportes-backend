"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { ApiError } from "@/lib/api/staff-client";
import {
  listarContaCorrente,
  type ContaCorrenteCliente,
} from "@/lib/api/conta-corrente-client";
import { formatCpfCnpjBr } from "@/lib/format-cpf-cnpj-br";
import { formatBRL } from "@/lib/financeiro/format";
import { isIntranetGestorRole } from "@/lib/intranet/intranet-path-access";
import { useStaffAuthStore } from "@/stores/staff-auth-store";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NotificationBadge } from "@/components/ui/notification-badge";

function saldoClass(situacao: ContaCorrenteCliente["situacao"]) {
  if (situacao === "CREDOR") return "text-emerald-400";
  if (situacao === "DEVEDOR") return "text-amber-400";
  return "text-muted-foreground";
}

export default function ContaCorrenteListPage() {
  const user = useStaffAuthStore((s) => s.user);
  const ok = isIntranetGestorRole(user?.role);
  const [search, setSearch] = useState("");
  const [somenteComSaldo, setSomenteComSaldo] = useState(false);
  const [items, setItems] = useState<ContaCorrenteCliente[]>([]);
  const [loading, setLoading] = useState(false);

  const carregar = useCallback(async () => {
    if (!ok) return;
    setLoading(true);
    try {
      const out = await listarContaCorrente({ search, somenteComSaldo });
      setItems(out.items);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível listar as contas.");
    } finally {
      setLoading(false);
    }
  }, [ok, search, somenteComSaldo]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  if (!ok) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Acesso restrito ao financeiro e à administração.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Conta corrente</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Caixa comercial por cliente: crédito (acordo, fatura maior que o combinado, PIX a maior) e
          débito (liberou a retirada para pagar depois). Não é o livro das faturas — é a folga do
          processo. O saldo entra na próxima fatura/pagamento quando o financeiro registrar a
          compensação.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Clientes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[220px] flex-1">
              <label className="mb-1 block text-xs text-muted-foreground">Buscar</label>
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Nome ou CNPJ"
              />
            </div>
            <label className="flex items-center gap-2 pb-2 text-sm">
              <input
                type="checkbox"
                checked={somenteComSaldo}
                onChange={(e) => setSomenteComSaldo(e.target.checked)}
              />
              Só com saldo
            </label>
            <Button type="button" variant="outline" onClick={() => void carregar()}>
              Filtrar
            </Button>
          </div>

          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum cliente neste filtro.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="py-2 pr-3 font-medium">Cliente</th>
                    <th className="py-2 pr-3 font-medium">CNPJ/CPF</th>
                    <th className="py-2 pr-3 font-medium">Situação</th>
                    <th className="py-2 pr-3 text-right font-medium">Saldo</th>
                    <th className="py-2 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((row) => (
                    <tr
                      key={row.id}
                      className={
                        row.comprovantesPendentes > 0
                          ? "border-t border-red-500/30 bg-red-500/5"
                          : "border-t border-border"
                      }
                    >
                      <td className="py-2.5 pr-3">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{row.razaoSocial}</p>
                          <NotificationBadge count={row.comprovantesPendentes ?? 0} />
                        </div>
                        {row.nomeFantasia ? (
                          <p className="text-xs text-muted-foreground">{row.nomeFantasia}</p>
                        ) : null}
                      </td>
                      <td className="py-2.5 pr-3 tabular-nums text-muted-foreground">
                        {formatCpfCnpjBr(row.cpfCnpj)}
                      </td>
                      <td className="py-2.5 pr-3 text-muted-foreground">{row.situacaoLabel}</td>
                      <td className={`py-2.5 pr-3 text-right tabular-nums font-semibold ${saldoClass(row.situacao)}`}>
                        {formatBRL(row.saldo)}
                      </td>
                      <td className="py-2.5 text-right">
                        <Button size="sm" variant="outline" asChild>
                          <Link href={`/financeiro/conta-corrente/${row.id}`}>Abrir</Link>
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
