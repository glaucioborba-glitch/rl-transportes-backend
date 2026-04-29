"use client";

import { useEffect, useState } from "react";
import { ApiError, staffJson } from "@/lib/api/staff-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type AuditRow = {
  id: string;
  tabela: string;
  registroId: string;
  acao: string;
  usuario: string;
  dadosAntes?: unknown;
  dadosDepois?: unknown;
  createdAt: string;
};

function extractIp(dados: unknown): string | null {
  if (!dados || typeof dados !== "object") return null;
  const o = dados as Record<string, unknown>;
  const req = o.request as Record<string, unknown> | undefined;
  if (req?.ip) return String(req.ip);
  return null;
}

export function AuditTrail({ tabela, registroId }: { tabela: string; registroId: string }) {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const data = await staffJson<AuditRow[]>(
          `/auditoria/registro/${encodeURIComponent(tabela)}/${encodeURIComponent(registroId)}`,
        );
        if (alive) setRows(Array.isArray(data) ? data : []);
      } catch (e) {
        if (alive) setErr(e instanceof ApiError ? e.message : "Falha na auditoria");
      }
    })();
    return () => {
      alive = false;
    };
  }, [tabela, registroId]);

  return (
    <Card className="border-white/10 bg-zinc-950/80">
      <CardHeader>
        <CardTitle className="text-base text-white">Auditoria</CardTitle>
      </CardHeader>
      <CardContent>
        {err ? <p className="text-sm text-red-400">{err}</p> : null}
        {!err && !rows.length ? <p className="text-sm text-zinc-500">Sem eventos registrados.</p> : null}
        <ul className="max-h-72 space-y-3 overflow-y-auto text-sm">
          {rows.map((r) => (
            <li key={r.id} className="rounded-lg border border-white/10 bg-black/30 px-3 py-2">
              <div className="flex flex-wrap justify-between gap-1 text-zinc-400">
                <span className="font-mono text-xs text-zinc-500">{new Date(r.createdAt).toLocaleString("pt-BR")}</span>
                <span className="text-amber-200/90">{r.acao}</span>
              </div>
              <p className="mt-1 text-zinc-300">
                Usuário: <span className="font-mono text-xs">{r.usuario}</span>
              </p>
              {extractIp(r.dadosDepois) || extractIp(r.dadosAntes) ? (
                <p className="text-xs text-zinc-500">IP: {extractIp(r.dadosDepois) ?? extractIp(r.dadosAntes)}</p>
              ) : null}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
