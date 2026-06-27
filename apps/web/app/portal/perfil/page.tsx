"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ApiError, fetchPortalDashboard } from "@/lib/api/portal-client";
import { resolvePortalClienteDisplayName } from "@/lib/portal-cliente-display";
import { logoutPortalCliente } from "@/lib/portal-logout";
import { toast } from "@/lib/toast";
import { usePortalAuthStore } from "@/stores/portal-store";
import { usePessoaAutorizadaStore } from "@/stores/pessoaAutorizadaStore";

export default function PerfilPage() {
  const router = useRouter();
  const user = usePortalAuthStore((s) => s.user);
  const cliente = usePortalAuthStore((s) => s.cliente);
  const clienteNome = usePortalAuthStore((s) => s.clienteNome);
  const pessoa = usePessoaAutorizadaStore((s) => s.pessoa);
  const [nomeClienteFallback, setNomeClienteFallback] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  const empresaNome = resolvePortalClienteDisplayName(cliente, clienteNome ?? nomeClienteFallback);
  const operadorNome = pessoa?.nome?.trim() || user?.nome?.trim() || null;

  const refreshClienteNome = useCallback(async () => {
    if (cliente) return;
    try {
      const d = await fetchPortalDashboard();
      const nome = d.cliente?.nome;
      setNomeClienteFallback(typeof nome === "string" ? nome : null);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Não foi possível carregar cadastro");
    }
  }, [cliente]);

  useEffect(() => {
    void refreshClienteNome();
  }, [refreshClienteNome]);

  async function logout() {
    setLoggingOut(true);
    try {
      await logoutPortalCliente();
      toast.message("Sessão encerrada");
      router.replace("/portal/login");
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <main className="mx-auto max-w-lg px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle>Perfil</CardTitle>
          <CardDescription>Dados da sessão portal e cadastro vinculado</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="space-y-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Empresa</p>
              <p className="text-base font-semibold text-white">{empresaNome ?? "—"}</p>
              {cliente?.cpfCnpj ? (
                <p className="font-mono text-xs text-slate-500">{cliente.cpfCnpj}</p>
              ) : null}
            </div>
            {operadorNome ? (
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Operador</p>
                <p className="text-white">{operadorNome}</p>
              </div>
            ) : null}
            <div className="space-y-1 border-t border-white/5 pt-3 text-slate-400">
              <p>
                E-mail: <span className="text-white">{user?.email ?? "—"}</span>
              </p>
              <p>
                clienteId:{" "}
                <span className="font-mono text-xs text-slate-500">
                  {String(user?.clienteId ?? "—")}
                </span>
              </p>
            </div>
          </div>
          <Button type="button" variant="outline" disabled>
            Alterar senha (INDISPONÍVEL nesta fase)
          </Button>
          <p className="text-xs text-slate-600">Tema: `rl-portal-theme` (localStorage).</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => router.push("/portal/perfil/pessoas")}>
              Gestão de equipe
            </Button>
            <Button type="button" variant="outline" onClick={() => router.push("/portal/perfil/seguranca")}>
              Segurança e intrusões
            </Button>
            <Button type="button" variant="outline" onClick={() => router.push("/portal/perfil/dispositivos")}>
              Dispositivos e sessões
            </Button>
            <Button type="button" variant="outline" onClick={() => router.push("/portal/dashboard")}>
              Dashboard
            </Button>
            <Button
              variant="ghost"
              className="text-red-300 hover:bg-red-500/10"
              disabled={loggingOut}
              onClick={() => void logout()}
            >
              Sair
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
