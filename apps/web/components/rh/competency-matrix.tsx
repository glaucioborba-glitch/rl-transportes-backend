"use client";

import { SkillComplianceMatrix } from "@/components/rh/skill-compliance-matrix";
import type { RhColaboradorDirectoryItem } from "@/lib/rh/types";

/** Matriz competências (papel implícito por linha = colaborador). */
export function CompetencyMatrix({ rows }: { rows: RhColaboradorDirectoryItem[] }) {
  return <SkillComplianceMatrix rows={rows} />;
}
