import type {
  EventoGatilhoTarifa,
  RegraTarifaria,
  StatusContainerTarifa,
  TipoContainerTarifa,
} from '@prisma/client';
import type { FaixaDiaria } from './faixa-diaria.types';

export type ContainerBillingContext = {
  tamanho?: string | null;
  tipo?: string | null;
  capacidade?: string | null;
  refrigerado?: boolean;
  setPoint?: number | null;
  statusContainer?: StatusContainerTarifa | null;
};

export type BillingRuleEngineInput = {
  gateInAt: Date;
  asOf: Date;
  regras: RegraTarifaria[];
  container: ContainerBillingContext;
  incluirGateIn?: boolean;
  incluirGateOut?: boolean;
  shiftingExtras?: number;
  /**
   * Dias com tomada reefer conectada (prorata).
   * Se omitido: cobra energia só quando `container.refrigerado` (intenção/legado).
   */
  diasEnergiaReefer?: number;
  pricingOverrides?: {
    diasFreeTime?: number;
    valorDiaria?: number;
    valorEnergiaReefer?: number;
    faixasDiaria?: FaixaDiaria[];
  };
  operacaoFimSemana?: boolean;
  feriadosDatas?: string[];
};

export type ItemFaturaCalculado = {
  regraTarifariaId: string | null;
  eventoGatilho: EventoGatilhoTarifa;
  descricao: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
};

export type BillingRuleEngineResult = {
  items: ItemFaturaCalculado[];
  valorTotal: number;
  diasNoPatio: number;
  diasFaturaveis: number;
  diasFreeTime: number;
  tipoContainer: TipoContainerTarifa;
};

export type RegraTarifariaLike = Pick<
  RegraTarifaria,
  | 'id'
  | 'eventoGatilho'
  | 'tipoContainer'
  | 'statusContainer'
  | 'valor'
  | 'diasFreeTime'
  | 'ativa'
  | 'nome'
> &
  Partial<Pick<RegraTarifaria, 'tipoContainerCodigo' | 'capacidadeCodigo' | 'containerTamanho' | 'faixasDiaria'>>;

export type LegacyTarifaLike = {
  freeTimeDias: number;
  valorDiaria: number;
  valorServicosExtras?: number;
};

export type ContainerMdmKeys = {
  tipoCodigo?: string | null;
  capacidadeCodigo?: string | null;
  containerTamanho?: string | null;
};
