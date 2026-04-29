"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useStaffAuthStore } from "@/stores/staff-auth-store";
import { toast } from "@/lib/toast";

const CONTAS = [
  { id: "cc-principal", nome: "Conta corrente — Banco 001", tipo: "CC", saldoProxy: "Ver extrato" },
  { id: "pj", nome: "Conta PJ — Operações", tipo: "PJ", saldoProxy: "Ver extrato" },
  { id: "reserva", nome: "Conta reserva — Liquidez", tipo: "Reserva", saldoProxy: "Ver extrato" },
];

export default function BancosPage() {
  const user = useStaffAuthStore((s) => s.user);
  const ok = user?.role === "ADMIN" || user?.role === "GERENTE";

  if (!ok) return <p className="text-amber-400">Somente gestão.</p>;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Contas bancárias</h1>
        <p className="text-sm text-zinc-500">Cadastro estático para cockpit; movimentos apenas registrados localmente (placeholder).</p>
      </div>
      <div className="grid grid-cols-12 gap-4">
        {CONTAS.map((c) => (
          <Card key={c.id} className="col-span-12 border-zinc-800 bg-zinc-900/70 md:col-span-4">
            <CardHeader>
              <CardTitle className="text-lg text-white">{c.nome}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-zinc-400">
              <p>
                Tipo: <span className="text-zinc-200">{c.tipo}</span>
              </p>
              <p>Saldo: {c.saldoProxy}</p>
              <div className="flex flex-col gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11 border-zinc-600"
                  onClick={() => toast("Registro de depósito (somente demonstração).")}
                >
                  Registrar depósito
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11 border-zinc-600"
                  onClick={() => toast("Registro de saque (somente demonstração).")}
                >
                  Registrar saque
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11 border-zinc-600"
                  onClick={() => toast("Transferência entre contas (somente demonstração).")}
                >
                  Transferência
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
