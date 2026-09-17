import { parseMoeda } from "@/lib/financeiro/format";

export type TipoLancamentoCc = "CREDITO" | "DEBITO";

export type MotivoLancamentoCc =
  | "ACORDO_COMERCIAL"
  | "AJUSTE_FATURA"
  | "PIX_A_MAIOR"
  | "LIBERACAO_PAGAR_DEPOIS"
  | "COMPENSACAO"
  | "OUTRO";

export const MOTIVO_CC_OPCOES: { value: MotivoLancamentoCc; label: string; tipos: TipoLancamentoCc[] }[] =
  [
    { value: "ACORDO_COMERCIAL", label: "Acordo comercial", tipos: ["CREDITO"] },
    { value: "AJUSTE_FATURA", label: "Ajuste de fatura", tipos: ["CREDITO", "DEBITO"] },
    { value: "PIX_A_MAIOR", label: "PIX a maior", tipos: ["CREDITO"] },
    { value: "LIBERACAO_PAGAR_DEPOIS", label: "Liberação — pagar depois", tipos: ["DEBITO"] },
    { value: "OUTRO", label: "Outro", tipos: ["CREDITO", "DEBITO"] },
  ];

export const parseValorBrl = parseMoeda;
