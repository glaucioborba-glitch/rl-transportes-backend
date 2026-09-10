import { StatusContainer, TipoOperacaoSolicitacaoIntent } from '@prisma/client';

export type DirecaoUnidade = 'ENTRADA' | 'SAIDA' | 'INTERNA';

const ENTRADA: ReadonlySet<string> = new Set([
  TipoOperacaoSolicitacaoIntent.SOLICITAR_BAIXA,
  TipoOperacaoSolicitacaoIntent.SOLICITAR_IMPORTACAO_COLETA_DEPOT,
]);

const SAIDA: ReadonlySet<string> = new Set([
  TipoOperacaoSolicitacaoIntent.SOLICITAR_COLETA,
  TipoOperacaoSolicitacaoIntent.SOLICITAR_EXPORTACAO_ENTREGA_DEPOT,
]);

const IMPORT_EXPORT: ReadonlySet<string> = new Set([
  TipoOperacaoSolicitacaoIntent.SOLICITAR_IMPORTACAO_COLETA_DEPOT,
  TipoOperacaoSolicitacaoIntent.SOLICITAR_EXPORTACAO_ENTREGA_DEPOT,
]);

/** Direção da unidade no pátio (não é a visita do caminhão). */
export function direcaoUnidade(
  intent: TipoOperacaoSolicitacaoIntent | string | null | undefined,
): DirecaoUnidade {
  const raw = String(intent ?? '');
  if (ENTRADA.has(raw)) return 'ENTRADA';
  if (SAIDA.has(raw)) return 'SAIDA';
  return 'INTERNA';
}

export function isDirecaoEntrada(
  intent: TipoOperacaoSolicitacaoIntent | string | null | undefined,
): boolean {
  return direcaoUnidade(intent) === 'ENTRADA';
}

export function isDirecaoSaida(
  intent: TipoOperacaoSolicitacaoIntent | string | null | undefined,
): boolean {
  return direcaoUnidade(intent) === 'SAIDA';
}

export function rotuloDirecaoUnidade(direcao: DirecaoUnidade): string {
  if (direcao === 'ENTRADA') return 'Entrada';
  if (direcao === 'SAIDA') return 'Saída';
  return 'Interna';
}

export function formatUnidadeProcessoId(numero: number): string {
  return `ID ${numero}`;
}

export function isImportacaoOuExportacao(
  intent: TipoOperacaoSolicitacaoIntent | string | null | undefined,
): boolean {
  return IMPORT_EXPORT.has(String(intent ?? ''));
}

/**
 * Importação/exportação em porto = CHEIO.
 * Movimento de vazio = sempre DEPOT (porto usado para vazio conta como depot).
 * Baixa/coleta do cliente: CHEIO ou VAZIO.
 */
export function assertCargaCompativelComIntent(
  intent: TipoOperacaoSolicitacaoIntent | string,
  status: StatusContainer | string,
): void {
  const carga = String(status ?? '').toUpperCase();
  if (carga !== StatusContainer.CHEIO && carga !== StatusContainer.VAZIO) {
    throw new Error(`Situação do contêiner inválida: ${carga || '—'}`);
  }
  void intent;
}

/** CHEIO em importação/exportação exige local PORTO quando o cadastro está disponível. */
export function assertLocalPortoParaCheio(
  intent: TipoOperacaoSolicitacaoIntent | string,
  status: StatusContainer | string,
  tipoLocal: string | null | undefined,
): void {
  if (!isImportacaoOuExportacao(intent)) return;
  if (String(status ?? '').toUpperCase() !== StatusContainer.CHEIO) return;
  if (!tipoLocal?.trim()) return;
  if (tipoLocal.trim().toUpperCase() !== 'PORTO') {
    throw new Error(
      'Importação/exportação de CHEIO deve usar local tipo PORTO. Vazio conta sempre como DEPOT.',
    );
  }
}
