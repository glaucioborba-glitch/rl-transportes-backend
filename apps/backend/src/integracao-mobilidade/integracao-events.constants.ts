/** Eventos corporativos para webhooks e barramento interno (Fase 14). */
export const INTEGRACAO_EVENTOS = [
  'gate.registrado',
  'patio.movimentado',
  'saida.registrada',
  'faturamento.gerado',
  'boleto.pago',
  'nfse.emitida',
  'solicitacao.atualizada',
  'pagamento.confirmado',
  'pagamento.atrasado',
  'pagamento.divergente',
  'ocr.normalizado',
  'iot.sensor',
] as const;

export type IntegracaoTipoEvento = (typeof INTEGRACAO_EVENTOS)[number];
