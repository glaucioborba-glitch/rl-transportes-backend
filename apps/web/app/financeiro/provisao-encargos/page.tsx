"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { EncargosSimulator } from "@/components/cadastros/encargos-simulator";
import { fetchEmpresaEncargos, type EncargosSnapshot } from "@/lib/api/empresa-client";
import { ApiError } from "@/lib/api/staff-client";
import { toast } from "@/lib/toast";
import { useStaffAuthStore } from "@/stores/staff-auth-store";

export default function ProvisaoEncargosPage() {
  const user = useStaffAuthStore((s) => s.user);
  const ok = user?.role === "ADMIN" || user?.role === "GERENTE";
  const [historico, setHistorico] = useState<EncargosSnapshot[]>([]);

  useEffect(() => {
    if (!ok) return;
    void fetchEmpresaEncargos()
      .then((r) => setHistorico(r.items))
      .catch((err) => {
        toast.error(err instanceof ApiError ? err.message : "Não foi possível carregar as provisões.");
      });
  }, [ok]);

  if (!ok) {
    return <p className="text-center text-amber-400">Acesso apenas para ADMIN ou GERENTE.</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Provisão de encargos</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Previsão de impostos da RL com as alíquotas de{" "}
          <Link href="/cadastros/empresa" className="text-primary underline">
            Cadastros → Empresa
          </Link>
          . <strong>Gerar agora</strong> cria a prévia do mês corrente (faturas já emitidas). No
          dia 1 o sistema fecha o <strong>mês anterior</strong> e substitui essa prévia. Não vira
          título em Contas a pagar.
        </p>
      </div>
      <EncargosSimulator historicoInicial={historico} />
    </div>
  );
}
