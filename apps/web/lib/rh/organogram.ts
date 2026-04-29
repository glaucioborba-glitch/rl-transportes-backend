export type OrgNode = {
  id: string;
  title: string;
  nivel: "diretoria" | "coordenacao" | "operadores";
  children?: OrgNode[];
};

/** Estrutura fixa; nomes reais injetados na árvore na página. */
export const ORG_TEMPLATE: OrgNode = {
  id: "dir",
  title: "Diretoria Operacional",
  nivel: "diretoria",
  children: [
    {
      id: "coord-ops",
      title: "Coordenação de Operações",
      nivel: "coordenacao",
      children: [],
    },
    {
      id: "coord-ssma",
      title: "Coordenação SSMA & Compliance",
      nivel: "coordenacao",
      children: [],
    },
  ],
};

export function injectOperatorLeaves(root: OrgNode, operatorNames: string[]): OrgNode {
  const clone: OrgNode = JSON.parse(JSON.stringify(root)) as OrgNode;
  const ops = clone.children?.find((c) => c.id === "coord-ops");
  if (!ops) return clone;
  ops.children = operatorNames.map((nome, i) => ({
    id: `op-${i}`,
    title: nome,
    nivel: "operadores" as const,
  }));
  return clone;
}
