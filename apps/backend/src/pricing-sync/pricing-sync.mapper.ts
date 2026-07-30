import {
  CategoriaItemTabelaPreco,
  EventoGatilhoTarifa,
  Prisma,
  StatusContainerTarifa,
  TipoContainerTarifa,
} from '@prisma/client';
import type { FaixaDiaria } from '../billing-engine/faixa-diaria.types';
import { resolveFaixasFromCadastroItem } from '../billing-engine/faixa-diaria-calculator';

export type CadastroArmazenagemItem = {
  id: string;
  tipoContainerCodigo: string | null;
  capacidadeCodigo: string | null;
  containerTamanho: string | null;
  statusContainer: StatusContainerTarifa;
  valorHandling: Prisma.Decimal | null;
  freeTimeDias: number | null;
  faixasDiaria: unknown;
  tarifaDiariaArmazenagem: Prisma.Decimal | null;
  tarifaEnergiaReeferDiaria: Prisma.Decimal | null;
};

export function inferTipoContainerTarifa(
  tipoCodigo: string | null | undefined,
  tamanho: string | null | undefined,
): TipoContainerTarifa {
  const tipo = (tipoCodigo ?? '').toUpperCase();
  if (tipo.includes('IMO') || tipo.includes('PERIG')) return TipoContainerTarifa.IMO_PERIGOSA;
  if (tipo.includes('REEFER') || tipo === 'RF') return TipoContainerTarifa.REEFER;
  const digits = (tamanho ?? '').replace(/\D/g, '');
  if (digits.startsWith('20')) return TipoContainerTarifa.DRY_20;
  if (digits.startsWith('40') || digits.startsWith('45')) return TipoContainerTarifa.DRY_40;
  return TipoContainerTarifa.TODOS;
}

export function resolveFaixasFromItem(item: CadastroArmazenagemItem): FaixaDiaria[] {
  return resolveFaixasFromCadastroItem({
    faixasDiaria: item.faixasDiaria,
    tarifaDiariaArmazenagem:
      item.tarifaDiariaArmazenagem != null ? Number(item.tarifaDiariaArmazenagem) : null,
    freeTimeDias: item.freeTimeDias,
  });
}

export function mapArmazenagemItemToRegras(
  item: CadastroArmazenagemItem,
  tabelaPrecoId: string,
): Prisma.RegraTarifariaCreateManyInput[] {
  const tipoCodigo = item.tipoContainerCodigo?.toUpperCase() ?? null;
  const capacidade = item.capacidadeCodigo?.toUpperCase() ?? null;
  const tamanho = item.containerTamanho ?? null;
  const tipoContainer = inferTipoContainerTarifa(tipoCodigo, tamanho);
  const faixas = resolveFaixasFromItem(item);
  const freeTime = item.freeTimeDias ?? 7;
  const handling = item.valorHandling != null ? Number(item.valorHandling) : 0;
  const labelBase = [tipoCodigo, capacidade, tamanho, item.statusContainer]
    .filter(Boolean)
    .join(' / ');

  const regras: Prisma.RegraTarifariaCreateManyInput[] = [];

  if (handling > 0) {
    regras.push({
      tabelaPrecoId,
      nome: `Handling ${labelBase}`,
      eventoGatilho: EventoGatilhoTarifa.HANDLING,
      tipoContainer,
      tipoContainerCodigo: tipoCodigo,
      capacidadeCodigo: capacidade,
      containerTamanho: tamanho,
      statusContainer: item.statusContainer,
      valor: new Prisma.Decimal(handling.toFixed(2)),
      diasFreeTime: 0,
      faixasDiaria: Prisma.JsonNull,
      ativa: true,
    });
  }

  regras.push({
    tabelaPrecoId,
    nome: `Diária ${labelBase}`,
    eventoGatilho: EventoGatilhoTarifa.DIARIA_ARMAZENAGEM,
    tipoContainer,
    tipoContainerCodigo: tipoCodigo,
    capacidadeCodigo: capacidade,
    containerTamanho: tamanho,
    statusContainer: item.statusContainer,
    valor: new Prisma.Decimal((faixas[0]?.valorDiaria ?? 0).toFixed(2)),
    diasFreeTime: freeTime,
    faixasDiaria: faixas as unknown as Prisma.InputJsonValue,
    ativa: true,
  });

  const energia =
    item.tarifaEnergiaReeferDiaria != null ? Number(item.tarifaEnergiaReeferDiaria) : 0;
  if (tipoContainer === TipoContainerTarifa.REEFER && energia > 0) {
    regras.push({
      tabelaPrecoId,
      nome: `Energia reefer ${labelBase}`,
      eventoGatilho: EventoGatilhoTarifa.ENERGIA_REEFER,
      tipoContainer,
      tipoContainerCodigo: tipoCodigo,
      capacidadeCodigo: capacidade,
      containerTamanho: tamanho,
      statusContainer: item.statusContainer,
      valor: new Prisma.Decimal(energia.toFixed(2)),
      diasFreeTime: 0,
      faixasDiaria: Prisma.JsonNull,
      ativa: true,
    });
  }

  return regras;
}

export function isArmazenagemItem(item: {
  categoriaItem?: CategoriaItemTabelaPreco;
  tipoOperacaoCodigo?: string;
}): boolean {
  return (
    item.categoriaItem === CategoriaItemTabelaPreco.ARMAZENAGEM ||
    item.tipoOperacaoCodigo?.toUpperCase() === 'ARMAZENAGEM'
  );
}
