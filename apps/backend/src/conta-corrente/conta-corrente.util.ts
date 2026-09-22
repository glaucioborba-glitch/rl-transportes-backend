import {
  MotivoLancamentoContaCorrente,
  TipoLancamentoContaCorrente,
} from '@prisma/client';

export const MOTIVO_CONTA_CORRENTE_LABEL: Record<MotivoLancamentoContaCorrente, string> = {
  ACORDO_COMERCIAL: 'Acordo comercial',
  AJUSTE_FATURA: 'Ajuste de fatura',
  PIX_A_MAIOR: 'PIX a maior',
  PIX_MANUAL_FORA_SISTEMA: 'PIX manual fora do sistema',
  LIBERACAO_PAGAR_DEPOIS: 'Liberação — pagar depois',
  COMPENSACAO: 'Compensação',
  QUITACAO_ID: 'Quitação do ID',
  OUTRO: 'Outro',
};

export function valorSinalLancamento(
  tipo: TipoLancamentoContaCorrente,
  valor: number,
): number {
  if (!Number.isFinite(valor) || valor <= 0) {
    throw new Error('Informe um valor maior que zero.');
  }
  const cents = Math.round(valor * 100);
  if (cents < 1) {
    throw new Error('Informe um valor maior que zero.');
  }
  const v = cents / 100;
  return tipo === TipoLancamentoContaCorrente.CREDITO ? v : -v;
}

export function classificarSaldo(saldo: number): 'CREDOR' | 'DEVEDOR' | 'ZERADO' {
  if (Math.abs(saldo) < 0.005) return 'ZERADO';
  return saldo > 0 ? 'CREDOR' : 'DEVEDOR';
}

export function rotuloSaldo(saldo: number): string {
  const kind = classificarSaldo(saldo);
  if (kind === 'ZERADO') return 'Saldo zerado';
  if (kind === 'CREDOR') return 'Crédito a favor do cliente';
  return 'Em aberto — pagar depois';
}

export const ANEXO_LANCAMENTO_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);
export const ANEXO_LANCAMENTO_MAX = 5 * 1024 * 1024;

export function toMoneyNumber(value: unknown): number {
  if (typeof value === 'number') return Math.round(value * 100) / 100;
  if (typeof value === 'string') return Math.round(Number(value) * 100) / 100 || 0;
  if (value && typeof value === 'object' && 'toString' in value) {
    return Math.round(Number(String(value)) * 100) / 100 || 0;
  }
  return 0;
}

export function ordenarContasCorrente<
  T extends { comprovantesPendentes: number; saldo: number; razaoSocial: string },
>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const pa = a.comprovantesPendentes > 0 ? 1 : 0;
    const pb = b.comprovantesPendentes > 0 ? 1 : 0;
    if (pb !== pa) return pb - pa;
    return Math.abs(b.saldo) - Math.abs(a.saldo) || a.razaoSocial.localeCompare(b.razaoSocial, 'pt-BR');
  });
}
