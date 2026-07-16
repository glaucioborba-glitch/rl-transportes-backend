"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle,
  Forklift,
  Loader2,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api/staff-client";
import {
  listCadastrosEquipamentos,
  vincularEquipamentoOperador,
  type CadastrosEquipamentoListItem,
} from "@/lib/api/cadastros-equipamentos-client";
import { daysUntil } from "@/lib/cadastros/formatters";
import { toast } from "@/lib/toast";

export default function LoginEquipamentoPage() {
  const router = useRouter();
  const [equipamentos, setEquipamentos] = useState<CadastrosEquipamentoListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [vinculando, setVinculando] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const data = await listCadastrosEquipamentos({ status: "disponiveis" });
        const items = (data.items || []).filter((eq) => eq.status !== "EM_MANUTENCAO");
        setEquipamentos(items);
      } catch {
        toast.error("Erro ao carregar equipamentos.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const vincularEquipamento = async (equipamentoId: string) => {
    setVinculando(equipamentoId);
    try {
      await vincularEquipamentoOperador(equipamentoId);
      toast.success("Equipamento vinculado com sucesso!");
      router.push("/operador/gate/dashboard");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Erro ao vincular equipamento.");
      setVinculando(null);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--accent)]" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6">
      <div className="w-full max-w-3xl space-y-6">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--accent)]/10">
            <Forklift className="h-8 w-8 text-[var(--accent)]" />
          </div>
          <h1 className="text-2xl font-bold">Selecionar Equipamento</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Antes de iniciar as operações, selecione qual equipamento você vai utilizar hoje. Este
            vínculo registra quem está com qual equipamento e por quanto tempo.
          </p>
        </div>

        {equipamentos.length === 0 ? (
          <div className="rounded-lg border border-amber-500/30 bg-card p-6 text-center">
            <AlertTriangle className="mx-auto mb-2 h-8 w-8 text-amber-400" />
            <p className="text-sm font-medium text-amber-400">Nenhum equipamento disponível</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Todos os equipamentos estão em uso ou em manutenção. Contate o gerente.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {equipamentos.map((eq) => {
              const dias = eq.proximaManutencao ? daysUntil(eq.proximaManutencao) : null;
              const manutencaoVencendo =
                dias !== null && dias >= 0 && dias <= 7;

              return (
                <button
                  key={eq.id}
                  type="button"
                  onClick={() => void vincularEquipamento(eq.id)}
                  disabled={vinculando !== null}
                  className="rounded-lg border border-border bg-card p-4 text-left transition-all hover:border-[var(--accent)]/40 hover:bg-[var(--accent)]/5 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className="font-mono font-bold text-[var(--accent)]">{eq.codigo}</span>
                    {vinculando === eq.id ? (
                      <Loader2 className="h-4 w-4 animate-spin text-[var(--accent)]" />
                    ) : (
                      <CheckCircle className="h-4 w-4 text-muted-foreground/50" />
                    )}
                  </div>
                  <p className="text-sm font-medium">
                    {eq.marca} {eq.modelo}
                  </p>
                  <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                    <p>Tipo: {eq.tipo.replace(/_/g, " ")}</p>
                    <p>Capacidade: {eq.capacidade || "—"} t</p>
                    <p>Horímetro: {eq.horimetro || 0} h</p>
                  </div>
                  {manutencaoVencendo && eq.proximaManutencao ? (
                    <div className="mt-2 flex items-center gap-1 text-xs text-amber-400">
                      <Wrench className="h-3 w-3" />
                      Manutenção em {dias} dias
                    </div>
                  ) : null}
                </button>
              );
            })}
          </div>
        )}

        <div className="text-center">
          <Button
            variant="link"
            size="sm"
            className="text-xs text-muted-foreground"
            onClick={() => router.push("/operador/gate/dashboard")}
          >
            Operar sem equipamento (apenas monitoramento) →
          </Button>
        </div>
      </div>
    </div>
  );
}
