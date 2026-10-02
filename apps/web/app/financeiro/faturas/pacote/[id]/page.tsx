"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { ApiError } from "@/lib/api/staff-client";
import { obterFaturaPacote, type FaturaPacoteDetalhe } from "@/lib/api/fatura-pacote-client";
import { formatCpfCnpjBr } from "@/lib/format-cpf-cnpj-br";
import { formatBRL } from "@/lib/financeiro/format";
import {
  formatDataHoraBr,
  labelModoFatura,
  labelStatusFatura,
  linhaMetaIdFatura,
  linhaTituloIdFatura,
} from "@/lib/financeiro/fatura-pacote-display";
import { FaturaIdComposicao } from "@/components/financeiro/fatura-id-composicao";
import { isIntranetGestorRole } from "@/lib/intranet/intranet-path-access";
import { useStaffAuthStore } from "@/stores/staff-auth-store";
import { toast } from "@/lib/toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function FinanceiroFaturaPacotePage() {
  const params = useParams<{ id: string }>();
  const user = useStaffAuthStore((s) => s.user);
  const ok = isIntranetGestorRole(user?.role);
  const [pacote, setPacote] = useState<FaturaPacoteDetalhe | null>(null);
  const [loading, setLoading] = useState(true);

  const carregar = useCallback(async () => {
    if (!ok || !params.id) return;
    setLoading(true);
    try {
      setPacote(await obterFaturaPacote(params.id));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível abrir a Fatura.");
    } finally {
      setLoading(false);
    }
  }, [ok, params.id]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  if (!ok) {
    return (
      <div>
        <p className="text-amber-400">Área restrita a gestão (ADMIN / GERENTE).</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!pacote) return null;

  return (
    <div className="min-w-0 max-w-full space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">{pacote.numero}</h1>
          <p className="mt-1 text-sm text-zinc-300">{pacote.cliente.razaoSocial}</p>
          <p className="font-mono text-sm text-zinc-400">{formatCpfCnpjBr(pacote.cliente.cpfCnpj)}</p>
          <p className="mt-1 text-sm text-zinc-400">
            {labelStatusFatura(pacote.status)} · {labelModoFatura(pacote.modo)}
          </p>
        </div>
        <p className="text-xl font-semibold text-white">{formatBRL(pacote.valorTotal)}</p>
      </div>

      {pacote.processamentoErro ? (
        <p className="rounded-md border border-amber-700/60 bg-amber-950/40 px-3 py-2 text-sm text-amber-200">
          {pacote.processamentoErro}
        </p>
      ) : null}

      <p className="text-sm text-zinc-400">
        {pacote.status === "RASCUNHO" && pacote.agendadoPara
          ? `Agendada para ${formatDataHoraBr(pacote.agendadoPara)}`
          : `Emissão ${formatDataHoraBr(pacote.dataEmissao)}`}
        {pacote.dataVencimento ? ` · vencimento ${formatDataHoraBr(pacote.dataVencimento)}` : ""}
      </p>

      <div className="flex flex-wrap gap-3 text-sm">
        {pacote.linkNfse ? (
          <a href={pacote.linkNfse} target="_blank" rel="noreferrer" className="text-sky-400 hover:underline">
            NFS-e
          </a>
        ) : null}
        {pacote.linkBoleto ? (
          <a href={pacote.linkBoleto} target="_blank" rel="noreferrer" className="text-sky-400 hover:underline">
            Boleto
          </a>
        ) : null}
        {pacote.linkPix ? (
          <a href={pacote.linkPix} target="_blank" rel="noreferrer" className="text-sky-400 hover:underline">
            PIX
          </a>
        ) : null}
      </div>

      {pacote.ids.map((row) => (
        <Card key={row.faturaId} className="border-zinc-800 bg-zinc-950/80">
          <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
            <div>
              <CardTitle className="text-base text-zinc-100">
                {linhaTituloIdFatura(row)}
              </CardTitle>
              <p className="mt-1 text-xs text-zinc-500">{linhaMetaIdFatura(row)}</p>
            </div>
            <p className="text-lg font-semibold text-white">{formatBRL(row.valorTotal)}</p>
          </CardHeader>
          <CardContent>
            <FaturaIdComposicao linhas={row.composicao} />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
