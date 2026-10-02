"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  ChevronDown,
  ChevronRight,
  Edit2,
  Plus,
  Users,
  Wallet,
  Wrench,
} from "lucide-react";
import { FinanceiroBreadcrumb, FinanceiroTabs } from "../components/financeiro-tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useWidgetData, WidgetError } from "@/components/ui/widget-error";
import {
  listCadastrosCentrosCusto,
  type CadastroCentroCusto,
} from "@/lib/api/cadastros-centros-custo-client";
import { canDo } from "@/lib/cadastros/permission-matrix";
import { useStaffAuthStore } from "@/stores/staff-auth-store";

type TreeNode = CadastroCentroCusto & { children: TreeNode[] };

function agruparHierarquia(centros: CadastroCentroCusto[]): TreeNode[] {
  const map = new Map<string, TreeNode>();
  const roots: TreeNode[] = [];
  for (const cc of centros) {
    map.set(cc.id, { ...cc, children: [] });
  }
  for (const cc of centros) {
    const node = map.get(cc.id)!;
    if (cc.paiId && map.has(cc.paiId)) {
      map.get(cc.paiId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

function LoadingSkeleton() {
  return <div className="h-64 animate-pulse rounded-lg border border-border bg-card" />;
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: typeof Wallet;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
      <Icon className={`h-5 w-5 ${color}`} />
      <div>
        <p className="text-xl font-bold tabular-nums">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

function CentroCustoNode({
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
          <Wallet className="h-4 w-4 text-[var(--accent)]" />
        </div>
        <div className="flex-1">
          <p className="font-mono text-sm font-bold">{node.codigo}</p>
          <p className="text-xs text-muted-foreground">{node.nome}</p>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {(node.colaboradoresVinculados ?? 0) > 0 ? (
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {node.colaboradoresVinculados}
            </span>
          ) : null}
          {(node.equipamentosVinculados ?? 0) > 0 ? (
            <span className="flex items-center gap-1">
              <Wrench className="h-3 w-3" />
              {node.equipamentosVinculados}
            </span>
          ) : null}
          <Badge
            variant="neutral"
            className={
              node.tipo === "SINTETICO"
                ? "border-blue-500/30 bg-blue-500/15 text-blue-400"
                : "border-green-500/30 bg-green-500/15 text-green-400"
            }
          >
            {node.tipo === "SINTETICO" ? "Sintético" : "Analítico"}
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
            <CentroCustoNode
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

export default function CentrosCustoPage() {
  const router = useRouter();
  const staffUser = useStaffAuthStore((s) => s.user);
  const user = {
    id: staffUser?.id,
    role: staffUser?.role ?? "",
    permissions: staffUser?.permissions,
  };
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const { data, loading, error, refetch } = useWidgetData(() => listCadastrosCentrosCusto(), []);

  const canCreate = canDo(user, "financeiro", "CREATE");
  const canEdit = canDo(user, "financeiro", "EDIT");

  const centros = data?.items ?? [];
  const arvore = useMemo(() => agruparHierarquia(centros), [centros]);

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
      <FinanceiroBreadcrumb current="Centros de Custo" />
      <FinanceiroTabs />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Centros de Custo</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Estrutura hierárquica de custos · Referenciada por Colaboradores e Equipamentos
          </p>
        </div>
        {canCreate ? (
          <Button
            variant="default"
            size="sm"
            onClick={() => router.push("/cadastros/financeiro/centros-custo/novo")}
          >
            <Plus className="mr-2 h-4 w-4" />
            Novo Centro
          </Button>
        ) : null}
      </div>

      {!loading && !error ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard icon={Building2} label="Centros" value={centros.length} color="text-blue-400" />
          <StatCard
            icon={Users}
            label="Colaboradores"
            value={centros.reduce((acc, c) => acc + (c.colaboradoresVinculados ?? 0), 0)}
            color="text-purple-400"
          />
          <StatCard
            icon={Wrench}
            label="Equipamentos"
            value={centros.reduce((acc, c) => acc + (c.equipamentosVinculados ?? 0), 0)}
            color="text-amber-400"
          />
          <StatCard
            icon={Wallet}
            label="Ativos"
            value={centros.filter((c) => c.ativo).length}
            color="text-green-400"
          />
        </div>
      ) : null}

      {loading ? <LoadingSkeleton /> : null}
      {!loading && error ? (
        <WidgetError title="Não foi possível carregar centros de custo" onRetry={refetch} />
      ) : null}

      {!loading && !error ? (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          {arvore.length === 0 ? (
            <div className="flex h-[40vh] flex-col items-center justify-center gap-3">
              <Wallet className="h-12 w-12 text-muted-foreground/30" />
              <p className="text-lg text-muted-foreground">Nenhum centro de custo cadastrado.</p>
            </div>
          ) : (
            <div className="divide-y divide-border/30">
              {arvore.map((cc) => (
                <CentroCustoNode
                  key={cc.id}
                  node={cc}
                  depth={0}
                  expanded={expanded}
                  onToggle={toggle}
                  canEdit={canEdit}
                  onEdit={(id) => router.push(`/cadastros/financeiro/centros-custo/${id}`)}
                />
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
