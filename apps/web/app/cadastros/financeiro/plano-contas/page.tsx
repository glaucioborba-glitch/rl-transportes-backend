"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  Edit2,
  Plus,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { FinanceiroBreadcrumb, FinanceiroTabs } from "../components/financeiro-tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useWidgetData, WidgetError } from "@/components/ui/widget-error";
import {
  listCadastrosPlanoContas,
  type CadastroPlanoConta,
} from "@/lib/api/cadastros-plano-contas-client";
import { canDo } from "@/lib/cadastros/permission-matrix";
import { useStaffAuthStore } from "@/stores/staff-auth-store";

type TreeNode = CadastroPlanoConta & { children: TreeNode[] };

function agruparHierarquia(contas: CadastroPlanoConta[]): TreeNode[] {
  const map = new Map<string, TreeNode>();
  const roots: TreeNode[] = [];
  for (const c of contas) map.set(c.id, { ...c, children: [] });
  for (const c of contas) {
    const node = map.get(c.id)!;
    if (c.paiId && map.has(c.paiId)) map.get(c.paiId)!.children.push(node);
    else roots.push(node);
  }
  return roots;
}

function LoadingSkeleton() {
  return <div className="h-64 animate-pulse rounded-lg border border-border bg-card" />;
}

function ContaNode({
  node,
  depth,
  expanded,
  onToggle,
  canEdit,
  onEdit,
}: {
  node: TreeNode;
  depth: number;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  canEdit: boolean;
  onEdit: (id: string) => void;
}) {
  const hasChildren = node.children.length > 0;
  const isExpanded = expanded.has(node.id);

  return (
    <div>
      <div
        className="flex cursor-pointer items-center gap-2 p-3 hover:bg-muted/20"
        style={{ paddingLeft: `${12 + depth * 24}px` }}
        onClick={() => hasChildren && onToggle(node.id)}
      >
        {hasChildren ? (
          isExpanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )
        ) : (
          <div className="w-4" />
        )}
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[var(--accent)]/10">
          {node.natureza === "RECEITA" ? (
            <TrendingUp className="h-4 w-4 text-green-400" />
          ) : (
            <TrendingDown className="h-4 w-4 text-red-400" />
          )}
        </div>
        <div className="flex-1">
          <p className="font-mono text-sm font-bold">{node.codigo}</p>
          <p className="text-xs text-muted-foreground">{node.nome}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant="neutral"
            className={
              node.natureza === "RECEITA"
                ? "border-green-500/30 bg-green-500/15 text-green-400"
                : node.natureza === "DESPESA"
                  ? "border-red-500/30 bg-red-500/15 text-red-400"
                  : "border-blue-500/30 bg-blue-500/15 text-blue-400"
            }
          >
            {node.natureza}
          </Badge>
          <Badge
            variant="neutral"
            className={
              node.tipo === "SINTETICA"
                ? "bg-muted text-muted-foreground"
                : "bg-[var(--accent)]/10 text-[var(--accent)]"
            }
          >
            {node.tipo === "SINTETICA" ? "Sintética" : "Analítica"}
          </Badge>
          {canEdit ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(node.id);
              }}
            >
              <Edit2 className="h-3 w-3" />
            </Button>
          ) : null}
        </div>
      </div>
      {hasChildren && isExpanded ? (
        <div>
          {node.children.map((child) => (
            <ContaNode
              key={child.id}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              onToggle={onToggle}
              canEdit={canEdit}
              onEdit={onEdit}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function PlanoContasPage() {
  const router = useRouter();
  const staffUser = useStaffAuthStore((s) => s.user);
  const user = {
    id: staffUser?.id,
    role: staffUser?.role ?? "",
    permissions: staffUser?.permissions,
  };
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const { data, loading, error, refetch } = useWidgetData(() => listCadastrosPlanoContas(), []);

  const canCreate = canDo(user, "financeiro", "CREATE");
  const canEdit = canDo(user, "financeiro", "EDIT");

  const contas = data?.items ?? [];
  const arvore = useMemo(() => agruparHierarquia(contas), [contas]);

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-6">
      <FinanceiroBreadcrumb current="Plano de Contas" />
      <FinanceiroTabs />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Plano de Contas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Estrutura contábil sintética/analítica · Classificação de receitas e despesas
          </p>
        </div>
        {canCreate ? (
          <Button
            variant="default"
            size="sm"
            onClick={() => router.push("/cadastros/financeiro/plano-contas/novo")}
          >
            <Plus className="mr-2 h-4 w-4" />
            Nova Conta
          </Button>
        ) : null}
      </div>

      {loading ? <LoadingSkeleton /> : null}
      {!loading && error ? (
        <WidgetError title="Não foi possível carregar o plano de contas" onRetry={refetch} />
      ) : null}

      {!loading && !error ? (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          {arvore.length === 0 ? (
            <div className="flex h-[40vh] flex-col items-center justify-center gap-3">
              <BookOpen className="h-12 w-12 text-muted-foreground/30" />
              <p className="text-lg text-muted-foreground">Nenhuma conta cadastrada.</p>
            </div>
          ) : (
            <div className="divide-y divide-border/30">
              {arvore.map((conta) => (
                <ContaNode
                  key={conta.id}
                  node={conta}
                  depth={0}
                  expanded={expanded}
                  onToggle={toggle}
                  canEdit={canEdit}
                  onEdit={(id) => router.push(`/cadastros/financeiro/plano-contas/${id}`)}
                />
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
