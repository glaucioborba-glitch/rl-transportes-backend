"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { AccessDenied } from "@/components/ui/access-denied";
import { CADASTROS_MODULE_ROLES, hasCadastrosModuleAccess } from "@/lib/cadastros/permission-matrix";
import { useStaffAuthStore } from "@/stores/staff-auth-store";

type Props = {
  children: ReactNode;
};

function CadastrosLoading() {
  return (
    <div className="flex h-[80vh] flex-col items-center justify-center gap-3 text-muted-foreground">
      <Loader2 className="h-8 w-8 animate-spin" />
      <p className="text-sm">Verificando permissões…</p>
    </div>
  );
}

export function CadastrosGuard({ children }: Props) {
  const user = useStaffAuthStore((s) => s.user);
  const [hydrating, setHydrating] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => setHydrating(false), 600);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (user) setHydrating(false);
  }, [user]);

  if (!user && hydrating) return <CadastrosLoading />;

  if (!user) {
    return <AccessDenied message="Você precisa estar autenticado." />;
  }

  if (user.role === "ADMIN" || user.role === "SUPER_ADMIN") {
    return <>{children}</>;
  }

  if (!CADASTROS_MODULE_ROLES.includes(user.role as (typeof CADASTROS_MODULE_ROLES)[number])) {
    return (
      <AccessDenied
        title="Acesso Restrito"
        message="O módulo de Cadastros é exclusivo para perfis de gestão (Admin, Gerente, Financeiro, RH)."
      />
    );
  }

  if (!hasCadastrosModuleAccess({ id: user.id, role: user.role, permissions: user.permissions })) {
    return (
      <AccessDenied
        title="Permissão não delegada"
        message="Você tem o perfil, mas não recebeu delegação de poderes para acessar Cadastros. Solicite ao administrador."
      />
    );
  }

  return <>{children}</>;
}
