"use client";

import { useEffect, useState } from "react";
import { fetchRhDirectoryMerged } from "@/lib/rh/merge-directory";
import { ORG_TEMPLATE, injectOperatorLeaves } from "@/lib/rh/organogram";
import type { RhColaboradorDirectoryItem } from "@/lib/rh/types";
import { OrganogramaTree } from "@/components/rh/organograma-tree";
import { TurnoAllocationBoard } from "@/components/rh/turno-allocation-board";
import { SkillComplianceMatrix } from "@/components/rh/skill-compliance-matrix";
import { RhCard } from "@/components/rh/rh-card";
import { useStaffAuthStore } from "@/stores/staff-auth-store";

export default function RhEstruturaPage() {
  const allowed = useStaffAuthStore((s) => s.user?.role === "ADMIN" || s.user?.role === "GERENTE");
  const [rows, setRows] = useState<RhColaboradorDirectoryItem[]>([]);

  useEffect(() => {
    void fetchRhDirectoryMerged().then(setRows);
  }, []);

  if (!allowed) return <p className="text-amber-400">Acesso restrito.</p>;

  const names = rows.slice(0, 12).map((r) => r.nome);
  const tree = injectOperatorLeaves(ORG_TEMPLATE, names.length ? names : ["Coordenação vaga — carregue colaboradores"]);

  const matrixRows = rows.filter((r) => r.role !== "ADMIN").slice(0, 16);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Estrutura organizacional</h1>
        <p className="text-sm text-zinc-500">Organograma funcional (JSON interno) + alocação por turno.</p>
      </div>
      <RhCard title="Organograma funcional" subtitle="Diretoria → Coordenação → Operadores">
        <OrganogramaTree root={tree} />
      </RhCard>
      <RhCard title="Visão matricial (áreas × turno)" subtitle="Proxy a partir do cadastro mesclado">
        <TurnoAllocationBoard rows={rows.map((r) => ({ id: r.id, nome: r.nome, role: r.role, turno: String(r.turno) }))} />
      </RhCard>
      <RhCard title="NR × competência (trecho)" subtitle="Apenas front — cores por celula">
        {matrixRows.length === 0 ? (
          <p className="text-sm text-zinc-500">Sem linhas para exibir.</p>
        ) : (
          <SkillComplianceMatrix rows={matrixRows} />
        )}
      </RhCard>
    </div>
  );
}
