"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, portalContainerPreFatura } from "@/lib/api/portal-client";
import type { PreFaturaPortalResponse } from "@/lib/armazenagem-pre-fatura";
import { formatDateBr, formatMoneyBrl } from "@/lib/armazenagem-pre-fatura";
import { formatContainerISO } from "@/utils/containerFormatter";

export function PreFaturaCustosCard({
  iso,
  compact = false,
}: {
  iso: string;
  compact?: boolean;
}) {
  const [data, setData] = useState<PreFaturaPortalResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!iso?.trim()) return;
    setLoading(true);
    setErr(null);
    try {
      setData(await portalContainerPreFatura(iso));
    } catch (e) {
      setData(null);
      setErr(e instanceof ApiError ? e.message : "Custos indisponíveis para este contêiner.");
    } finally {
      setLoading(false);
    }
  }, [iso]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return compact ? (
      <Skeleton className="h-24 w-full" />
    ) : (
      <Skeleton className="h-40 w-full" />
    );
  }

  if (err || !data) {
    if (compact) return null;
    return (
      <Card className="border-white/10 bg-black/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Custos acumulados</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-slate-500">{err ?? "Sem provisão ativa."}</CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-amber-500/25 bg-amber-500/5">
      <CardHeader className="pb-2">
        <CardTitle className="text-base text-amber-100">Custos acumulados</CardTitle>
        <CardDescription className="text-amber-200/70">
          {formatContainerISO(data.containerIso) || data.isoFormatado}
          {data.status === "CONSOLIDADA" ? " · consolidado" : " · provisão diária"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-xs uppercase tracking-widest text-amber-200/60">Valor provisionado</p>
            <p className="text-2xl font-bold text-white">{formatMoneyBrl(data.valorAcumulado)}</p>
          </div>
          <div className="text-right text-slate-300">
            <p>
              <span className="text-slate-500">Diárias:</span> {data.diasCobrados}
            </p>
            <p>
              <span className="text-slate-500">Free time:</span> {data.freeTimeDias} dias
            </p>
          </div>
        </div>

        <dl className="grid gap-1 text-xs text-slate-400 sm:grid-cols-2">
          <div>
            <dt className="text-slate-500">Gate-in</dt>
            <dd className="text-slate-200">{formatDateBr(data.gateInEm)}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Início cobrança</dt>
            <dd className="text-slate-200">{formatDateBr(data.cobrancaInicioEm)}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Diária (tarifa)</dt>
            <dd className="text-slate-200">{formatMoneyBrl(data.valorDiaria)}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Dias no pátio</dt>
            <dd className="text-slate-200">{data.diasEstadia}</dd>
          </div>
        </dl>

        <p className="rounded-lg border border-amber-500/30 bg-amber-950/30 px-3 py-2 text-xs text-amber-100/90">
          {data.aviso}
        </p>
      </CardContent>
    </Card>
  );
}
