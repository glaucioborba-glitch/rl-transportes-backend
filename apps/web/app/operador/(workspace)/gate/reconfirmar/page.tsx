"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { fetchReconfirmacoes, type OperacaoDto } from "@/lib/gate/operacao-api";

export default function ReconfirmarListPage() {
  const [items, setItems] = useState<OperacaoDto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetchReconfirmacoes()
      .then((r) => setItems(r.items ?? []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Reconfirmações Pendentes</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Vistorias fotográficas aguardando conferência do Gate CPO
        </p>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma vistoria aguardando reconfirmação.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((op) => (
            <li key={op.protocolo}>
              <Link
                href={`/operador/gate/reconfirmar/${encodeURIComponent(op.protocolo)}`}
                className="flex items-center justify-between rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/30"
              >
                <div>
                  <p className="font-bold">{op.protocolo}</p>
                  <p className="text-sm text-muted-foreground">
                    {op.containerNumero} · {op.placa} · {op.clienteNome}
                  </p>
                  {(op.vistoria?.avarias?.length ?? 0) > 0 && (
                    <p className="mt-1 flex items-center gap-1 text-xs text-amber-400">
                      <AlertTriangle className="h-3 w-3" />
                      {op.vistoria!.avarias.length} avaria(s)
                    </p>
                  )}
                </div>
                <Badge variant="neutral" className="border-amber-500/30 bg-amber-500/15 text-amber-400">
                  Aguardando
                </Badge>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
