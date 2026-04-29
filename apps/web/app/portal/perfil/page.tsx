"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { jwtDecode } from "jwt-decode";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { authMe, ApiError, fetchCliente } from "@/lib/api/portal-client";
import type { CorporateJwtPayload } from "@/lib/api/types";
import { clearPortalSessionCookie } from "@/lib/auth-cookie";
import { toast } from "@/lib/toast";
import { usePortalAuthStore } from "@/stores/portal-store";

export default function PerfilPage() {
  const router = useRouter();
  const accessToken = usePortalAuthStore((s) => s.accessToken);
  const user = usePortalAuthStore((s) => s.user);
  const setUser = usePortalAuthStore((s) => s.setUser);
  const clear = usePortalAuthStore((s) => s.clear);
  const [nomeCliente, setNomeCliente] = useState<string | null>(null);

  const jwtSlice = (() => {
    if (!accessToken) return null;
    try {
      return jwtDecode<CorporateJwtPayload>(accessToken);
    } catch {
      return null;
    }
  })();

  const refreshMe = useCallback(async () => {
    if (!accessToken) return;
    try {
      const me = await authMe(accessToken);
      setUser({
        id: me.id,
        email: me.email,
        role: me.role,
        permissions: me.permissions,
        clienteId: me.clienteId ?? null,
      });
      if (me.clienteId) {
        const c = await fetchCliente(me.clienteId);
        setNomeCliente(typeof c.nome === "string" ? c.nome : null);
      }
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Não foi possível atualizar perfil");
    }
  }, [accessToken, setUser]);

  useEffect(() => {
    void refreshMe();
  }, [refreshMe]);

  function logout() {
    clear();
    void usePortalAuthStore.persist.clearStorage();
    clearPortalSessionCookie();
    toast.message("Sessão encerrada");
    router.replace("/login");
  }

  return (
    <main className="mx-auto max-w-lg px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle>Perfil</CardTitle>
          <CardDescription>GET /auth/me · GET /clientes/:id (próprio cadastro)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="space-y-1 text-slate-400">
            <p>
              Nome (cadastro): <span className="text-white">{nomeCliente ?? "—"}</span>
            </p>
            <p>
              E-mail: <span className="text-white">{user?.email ?? jwtSlice?.email ?? "—"}</span>
            </p>
            <p>
              clienteId (JWT / sessão):{" "}
              <span className="font-mono text-xs text-slate-500">
                {String(user?.clienteId ?? jwtSlice?.clienteId ?? "—")}
              </span>
            </p>
          </div>
          <Button type="button" variant="outline" disabled>
            Alterar senha (PATCH /auth/users não exposto ao CLIENTE)
          </Button>
          <p className="text-xs text-slate-600">
            Preferências: tema escuro persistido em `rl-portal-theme`; idioma futuro.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => router.push("/portal/dashboard")}>
              Dashboard
            </Button>
            <Button variant="ghost" className="text-red-300 hover:bg-red-500/10" onClick={() => logout()}>
              Sair
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
