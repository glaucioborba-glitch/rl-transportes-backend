"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatIsoDisplay } from "@/lib/container-display";
import { toast } from "@/lib/toast";
import { ApiError } from "@/lib/api/staff-client";
import {
  abrirCessaoComprovante,
  fetchCessaoPendenciasNfse,
  postConfirmarReemissaoCessao,
} from "@/lib/gate/operacao-api";

export default function CessaoTitularidadeFinanceiroPage() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<
    Awaited<ReturnType<typeof fetchCessaoPendenciasNfse>>["items"]
  >([]);
  const [obs, setObs] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const out = await fetchCessaoPendenciasNfse();
      setItems(out.items);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Falha ao listar cessões.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function confirmar(id: string) {
    setBusyId(id);
    try {
      await postConfirmarReemissaoCessao(id, obs[id]?.trim() || undefined);
      toast.success("Fatura reemitida para o novo pagador.");
      await carregar();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível reemitir.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Cessão de titularidade</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Quando a NFS-e já foi emitida no cliente A, o Gate só registra a cessão. Cancele a nota na
          prefeitura e, em seguida, confirme aqui a reemissão no cliente B (mesmo valor).
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Aguardando cancelamento de NFS-e</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma cessão pendente de reemissão.</p>
          ) : (
            <div className="space-y-4">
              {items.map((row) => (
                <div key={row.id} className="rounded-lg border border-border p-4 space-y-3">
                  <p className="font-semibold">
                    {row.idLabel} · {formatIsoDisplay(row.unidadeIso)}
                  </p>
                  <p className="text-sm">
                    De {row.de.nome} → {row.para.nome}
                  </p>
                  <p className="text-xs text-muted-foreground">{row.motivo}</p>
                  {row.comprovante ? (
                    <button
                      type="button"
                      className="text-sm text-primary underline"
                      onClick={() =>
                        void abrirCessaoComprovante(row.id).catch((err) =>
                          toast.error(
                            err instanceof ApiError ? err.message : "Falha ao abrir comprovante.",
                          ),
                        )
                      }
                    >
                      Comprovante: {row.comprovante.nome}
                    </button>
                  ) : (
                    <p className="text-xs text-amber-300">Sem comprovante anexado.</p>
                  )}
                  <Input
                    placeholder="Observação (opcional) — nº de cancelamento da NFS-e"
                    value={obs[row.id] ?? ""}
                    onChange={(e) => setObs((s) => ({ ...s, [row.id]: e.target.value }))}
                  />
                  <Button
                    type="button"
                    disabled={busyId === row.id}
                    onClick={() => void confirmar(row.id)}
                  >
                    {busyId === row.id ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    NFS-e cancelada — reemitir para {row.para.nome}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
