"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  Boxes,
  ChevronRight,
  DollarSign,
  FileText,
  Settings,
  ShieldCheck,
  Users,
} from "lucide-react";
import { canDo, type CadastrosUserContext } from "@/lib/cadastros/permission-matrix";
import { useStaffAuthStore } from "@/stores/staff-auth-store";
import { cn } from "@/lib/utils";

type BlocoCardDef = {
  id: string;
  title: string;
  href: string;
  icon: LucideIcon;
  desc: string;
  adminOnly?: boolean;
};

const BLOCOS: BlocoCardDef[] = [
  {
    id: "pessoas",
    title: "Pessoas & Entidades",
    href: "/cadastros/pessoas",
    icon: Users,
    desc: "Clientes, Colaboradores, Motoristas, Transportadoras, Fornecedores, Visitantes",
  },
  {
    id: "operacional",
    title: "Operacional",
    href: "/cadastros/operacional",
    icon: Boxes,
    desc: "Contêineres, Equipamentos, Posições, Tipos de Operação, Turnos",
  },
  {
    id: "financeiro",
    title: "Financeiro",
    href: "/cadastros/financeiro",
    icon: DollarSign,
    desc: "Bancos, Centros de Custo, Plano de Contas, Tabelas de Preços",
  },
  {
    id: "contratos",
    title: "Contratos & Documentos",
    href: "/cadastros/contratos",
    icon: FileText,
    desc: "Contratos, Aditivos, Tipos de Documentos, Templates",
  },
  {
    id: "parametros",
    title: "Parâmetros do Sistema",
    href: "/cadastros/parametros",
    icon: Settings,
    desc: "Parâmetros, Feriados, SLA, Configurações de Pátio",
  },
  {
    id: "permissoes",
    title: "Permissões",
    href: "/cadastros/permissoes",
    icon: ShieldCheck,
    desc: "Delegação de poderes aos usuários da Intranet",
    adminOnly: true,
  },
];

function BlocoCard({ bloco, user }: { bloco: BlocoCardDef; user: CadastrosUserContext }) {
  if (bloco.adminOnly && user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
    return null;
  }

  const blockId = bloco.id as "pessoas" | "operacional" | "financeiro" | "contratos" | "parametros";
  const canView =
    bloco.id === "permissoes"
      ? user.role === "ADMIN" || user.role === "SUPER_ADMIN"
      : canDo(user, blockId, "VIEW");
  const canEdit = bloco.id !== "permissoes" && canDo(user, blockId, "EDIT");
  const Icon = bloco.icon;

  if (!canView) return null;

  return (
    <Link
      href={bloco.href}
      className="group rounded-lg border border-border bg-card p-5 transition-colors hover:border-[var(--accent)]/40 hover:bg-white/[0.02]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[var(--accent)]/10">
          <Icon className="h-5 w-5 text-[var(--accent)]" />
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
      </div>
      <h2 className="mt-4 text-base font-semibold">{bloco.title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{bloco.desc}</p>
      <p className="mt-3 text-xs text-muted-foreground/70">
        {canEdit ? "Edição habilitada" : "Somente visualização"}
      </p>
    </Link>
  );
}

export default function CadastrosLandingPage() {
  const staffUser = useStaffAuthStore((s) => s.user);
  const user: CadastrosUserContext = {
    id: staffUser?.id,
    role: staffUser?.role ?? "",
    permissions: staffUser?.permissions,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Cadastros</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Master Data Management — fonte única de dados mestres da empresa. Todos os cadastros são
          gerenciados aqui e consumidos pelos módulos operacionais.
        </p>
      </div>

      <div className={cn("grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3")}>
        {BLOCOS.map((bloco) => (
          <BlocoCard key={bloco.id} bloco={bloco} user={user} />
        ))}
      </div>
    </div>
  );
}
