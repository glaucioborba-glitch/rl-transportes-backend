import { BadRequestException } from '@nestjs/common';

export const TIPOS_LOCAL_TRANSPORTE = ['TERMINAL', 'PORTO', 'DEPOSITO', 'CIDADE', 'OUTRO'] as const;
export type TipoLocalTransporte = (typeof TIPOS_LOCAL_TRANSPORTE)[number];

/** Ordena os dois locais para que FL×Portonave e Portonave×FL sejam o mesmo trecho. */
export function pairLocaisTransporte(
  local1Id: string,
  local2Id: string,
): { localAId: string; localBId: string } {
  const a = local1Id.trim();
  const b = local2Id.trim();
  if (!a || !b) {
    throw new BadRequestException('Origem e destino são obrigatórios.');
  }
  if (a === b) {
    throw new BadRequestException('Origem e destino precisam ser locais diferentes.');
  }
  return a < b ? { localAId: a, localBId: b } : { localAId: b, localBId: a };
}

export function rotuloTrecho(nome1: string, nome2: string): string {
  const [esq, dir] = [nome1, nome2].sort((x, y) => x.localeCompare(y, 'pt-BR'));
  return `${esq} × ${dir}`;
}

export const STATUS_CARGA_TRANSPORTE = ['CHEIO', 'VAZIO'] as const;
export type StatusCargaTransporte = (typeof STATUS_CARGA_TRANSPORTE)[number];

/** Frete de retorno: cobrado ao cliente e pago ao terceiro ficam em 50% da tabela. */
export const FATOR_RETORNO_TRANSPORTE = 0.5;

export function roundMoneyTransporte(valor: number): number {
  return Math.round(valor * 100) / 100;
}

export function valorCobradoTransporte(valorTabela: number, retorno: boolean): number {
  return roundMoneyTransporte(valorTabela * (retorno ? FATOR_RETORNO_TRANSPORTE : 1));
}

export function valorPagoTerceiroEfetivo(
  valorTabela: number | null,
  retorno: boolean,
): number | null {
  if (valorTabela == null) return null;
  return valorCobradoTransporte(valorTabela, retorno);
}
