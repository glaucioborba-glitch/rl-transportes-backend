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
  /** Após transbordo / troca cheio↔vazio, handling usa tarifa CHEIO. */
  faturarHandlingComoCheio?: boolean;
};

export type BillingRuleEngineInput = {
  gateInAt: Date;
  asOf: Date;
  regras: RegraTarifaria[];
  container: ContainerBillingContext;
  incluirGateIn?: boolean;
  incluirGateOut?: boolean;
  /** Handling automático excluído com senha gerencial — não relança nem substitui por taxa de gate. */
  omitirHandling?: boolean;
  /** Tomada automática excluída com senha gerencial — não relança energia reefer. */
  omitirEnergia?: boolean;
  shiftingExtras?: number;
  /**
   * Dias com tomada reefer conectada (prorata).
   * Se omitido: cobra energia só quando `container.refrigerado` (intenção/legado).
   */
  diasEnergiaReefer?: number;
  pricingOverrides?: {
    diasFreeTime?: number;
    valorDiaria?: number;
    valorHandling?: number;
    valorEnergiaReefer?: number;
    /** Quando a tarifa vem da tabela comercial, não aplica fator de set point. */
    energiaUsaFatorSetPoint?: boolean;
    faixasDiaria?: FaixaDiaria[];
    faixasEnergiaReefer?: FaixaDiaria[];
  };
  operacaoFimSemana?: boolean;
  feriadosDatas?: string[];
};

export type ItemFaturaCalculado = {
  regraTarifariaId: string | null;
  eventoGatilho: EventoGatilhoTarifa;
  descricao: string;
  /** Detalhe por faixa, reutilizado em simulação e fatura. */
  detalheCobranca?: string;
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

export type ContainerMdmKeys = {
  tipoCodigo?: string | null;
  capacidadeCodigo?: string | null;
  containerTamanho?: string | null;
};
