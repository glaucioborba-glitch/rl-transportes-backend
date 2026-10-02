"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, fetchPortalContaCorrente, type PortalContaCorrente } from "@/lib/api/portal-client";
import { formatBRL } from "@/lib/financeiro/format";
import { toast } from "@/lib/toast";

function saldoClass(situacao: PortalContaCorrente["cliente"]["situacao"]) {
  if (situacao === "CREDOR") return "text-emerald-400";
  if (situacao === "DEVEDOR") return "text-amber-400";
  return "text-white";
}

export default function PortalContaCorrentePage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<PortalContaCorrente | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await fetchPortalContaCorrente());
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Não foi possível abrir a conta corrente");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !data) {
    return (
      <main className="mx-auto w-[90%] px-4 py-8">
        <Skeleton className="h-40 w-full" />
      </main>
    );
  }

  const cliente = data?.cliente;
  const lancamentos = data?.lancamentos ?? [];

  return (
    <main className="mx-auto w-[90%] space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-white">Conta corrente</h1>
          <p className="text-sm text-slate-400">Extrato dos lançamentos da sua conta.</p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/portal/financeiro">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Voltar
          </Link>
        </Button>
      </div>

      {cliente ? (
        <Card>
          <CardHeader>
            <CardTitle>Saldo</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-3xl font-semibold tabular-nums ${saldoClass(cliente.situacao)}`}>
              {formatBRL(cliente.saldo)}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{cliente.situacaoLabel}</p>
          </CardContent>
        </Card>
      ) : (
        <p className="text-sm text-slate-500">Não foi possível carregar o saldo.</p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Extrato</CardTitle>
        </CardHeader>
        <CardContent>
          {lancamentos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum lançamento ainda.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="py-2 pr-3 font-medium">Quando</th>
                    <th className="py-2 pr-3 font-medium">Tipo</th>
                    <th className="py-2 pr-3 font-medium">Motivo</th>
                    <th className="py-2 pr-3 font-medium">Descrição</th>
                    <th className="py-2 pr-3 text-right font-medium">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {lancamentos.map((l) => (
                    <tr key={l.id} className="border-t border-white/10">
                      <td className="py-2.5 pr-3 text-muted-foreground">
                        {new Date(l.createdAt).toLocaleString("pt-BR")}
                      </td>
                      <td className="py-2.5 pr-3">{l.tipo === "CREDITO" ? "Crédito" : "Débito"}</td>
                      <td className="py-2.5 pr-3">{l.motivoLabel}</td>
                      <td className="py-2.5 pr-3">
                        {l.descricao}
                        {l.referencia ? (
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            Ref.: {l.referencia}
                          </span>
                        ) : null}
                      </td>
                      <td
                        className={`py-2.5 text-right tabular-nums font-medium ${
                          l.tipo === "CREDITO" ? "text-emerald-400" : "text-amber-400"
                        }`}
                      >
                        {l.tipo === "CREDITO" ? "+" : "−"}
                        {formatBRL(l.valor)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
