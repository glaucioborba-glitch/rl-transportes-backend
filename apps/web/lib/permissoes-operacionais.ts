import type { PermissoesPessoa } from "@/stores/pessoaPermissoesStore";

export const PERM_LABELS_OPERACIONAIS: Array<{ key: keyof PermissoesPessoa; label: string }> = [
  { key: "podeCriarSolicitacao", label: "Pode criar solicitações" },
  { key: "podeAnexarDocumentos", label: "Pode anexar documentos" },
  { key: "podeAgendarTurno", label: "Pode agendar turno" },
  { key: "podeVisualizarFinanceiro", label: "Pode visualizar financeiro" },
  { key: "podeAprovarOS", label: "Pode aprovar OS" },
  { key: "podeAlterarDadosGate", label: "Pode alterar dados no gate" },
  { key: "podeGerarPDF", label: "Pode gerar PDF" },
  { key: "podeGerenciarPessoas", label: "Pode gerenciar pessoas" },
];
