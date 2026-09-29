"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Shield, UserPlus, Users } from "lucide-react";
import { AccessDenied } from "@/components/ui/access-denied";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  canDo,
  listStoredCadastrosDelegations,
  removeCadastrosDelegation,
  type CadastroBlock,
  type CadastrosUserContext,
} from "@/lib/cadastros/permission-matrix";
import { useStaffAuthStore } from "@/stores/staff-auth-store";

type ListedUser = CadastrosUserContext & {
  id: string;
  name: string;
  email: string;
};

const BLOCKS: { key: CadastroBlock; label: string }[] = [
  { key: "pessoas", label: "Pessoas" },
  { key: "operacional", label: "Oper." },
  { key: "financeiro", label: "Financ." },
  { key: "contratos", label: "Contr." },
  { key: "parametros", label: "Parâm." },
];

function PermissionDot({ block, user }: { block: CadastroBlock; user: CadastrosUserContext }) {
  const canView = canDo(user, block, "VIEW");
  const canEdit = canDo(user, block, "EDIT");

  if (canEdit) {
    return <span className="inline-block h-3 w-3 rounded-full bg-green-500" title="Pode editar" />;
  }
  if (canView) {
    return <span className="inline-block h-3 w-3 rounded-full bg-blue-500" title="Só visualiza" />;
  }
  return <span className="inline-block h-3 w-3 rounded-full bg-zinc-600" title="Sem acesso" />;
}

function UserPermissionRow({
  user,
  onRemove,
}: {
  user: ListedUser;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="grid grid-cols-12 items-center gap-4 border-b border-border/50 p-4">
      <div className="col-span-3">
        <p className="text-sm font-medium">{user.name}</p>
        <p className="text-xs text-muted-foreground">{user.email}</p>
      </div>
      <div className="col-span-2">
        <Badge variant="neutral">{user.role}</Badge>
      </div>
      {BLOCKS.map((block) => (
        <div key={block.key} className="col-span-1 flex justify-center">
          <PermissionDot block={block.key} user={user} />
        </div>
      ))}
      <div className="col-span-2 flex justify-center gap-2">
        <Button variant="outline" size="sm" disabled>
          <Shield className="mr-1 h-3.5 w-3.5" />
          Editar poderes
        </Button>
        <Button variant="ghost" size="sm" onClick={() => onRemove(user.id)}>
          Remover
        </Button>
      </div>
    </div>
  );
}

export default function PermissoesPage() {
  const staffUser = useStaffAuthStore((s) => s.user);
  const isAdmin = staffUser?.role === "ADMIN" || staffUser?.role === "SUPER_ADMIN";
  const [delegationTick, setDelegationTick] = useState(0);

  const users: ListedUser[] = useMemo(() => {
    return listStoredCadastrosDelegations().map((d) => ({
      id: d.userId,
      name: d.userName,
      email: d.userEmail,
      role: d.userRole,
      permissions: d.permissions.flatMap((p) => p.actions.map((a) => `${p.block}:${a.toLowerCase()}`)),
      cadastrosDelegation: d,
    }));
  }, [delegationTick]);

  if (!isAdmin) {
    return (
      <AccessDenied
        title="Acesso Restrito"
        message="A delegação de poderes é exclusiva para administradores."
      />
    );
  }

  function handleRemove(userId: string) {
    removeCadastrosDelegation(userId);
    setDelegationTick((n) => n + 1);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Delegação de Poderes</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Defina quais usuários podem acessar cada bloco de cadastro e quais ações podem executar.
          Igual ao Portal do Cliente, onde você autoriza usuários — aqui você delega poderes de gestão.
        </p>
      </div>

      {users.length === 0 ? (
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 rounded-lg border border-border bg-card px-6 py-16">
          <Users className="h-12 w-12 text-muted-foreground/30" />
          <p className="text-lg text-muted-foreground">Nenhum usuário na lista.</p>
          <p className="max-w-md text-center text-sm text-muted-foreground/70">
            Cadastros → Pessoas saíram da tela. Cadastre a equipe real em RH → Colaboradores.
          </p>
          <Button asChild variant="default" className="mt-2">
            <Link href="/rh/colaboradores/novo">
              <UserPlus className="mr-2 h-4 w-4" />
              Cadastrar colaborador
            </Link>
          </Button>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card">
          <div className="grid grid-cols-12 gap-4 border-b border-border p-4 text-xs uppercase tracking-wider text-muted-foreground">
            <div className="col-span-3">Usuário</div>
            <div className="col-span-2">Perfil</div>
            {BLOCKS.map((block) => (
              <div key={block.key} className="col-span-1 text-center">
                {block.label}
              </div>
            ))}
            <div className="col-span-2 text-center">Ações</div>
          </div>

          {users.map((user) => (
            <UserPermissionRow key={user.id} user={user} onRemove={handleRemove} />
          ))}
        </div>
      )}

      {users.length > 0 ? (
        <>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-full bg-green-500" />
              Pode editar
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-full bg-blue-500" />
              Só visualiza
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-full bg-zinc-600" />
              Sem acesso
            </span>
          </div>
          <Button asChild variant="default">
            <Link href="/rh/colaboradores/novo">
              <UserPlus className="mr-2 h-4 w-4" />
              Cadastrar colaborador
            </Link>
          </Button>
        </>
      ) : null}
    </div>
  );
}
