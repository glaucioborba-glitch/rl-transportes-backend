import { lacreRic } from '../common/utils/lacre-operacional.util';

/**
 * Lacre do saldo/estoque (coleta e exportação): o atual da caixa.
 * Depois de SUBSTITUIR_LACRE_SAIDA, vale o lacre de saída.
 */
export function lacreEstoquePatio(
  statusContainer: 'CHEIO' | 'VAZIO' | null,
  lacreEntrada?: string | null,
  lacreSaida?: string | null,
): string | null {
  if (statusContainer === 'VAZIO') return null;
  return lacreRic('SAIDA', lacreEntrada, lacreSaida);
}
