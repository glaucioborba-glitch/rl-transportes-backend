import type {
  EventoGatilhoTarifa,
  RegraTarifaria,
  TipoContainerTarifa,
} from '@prisma/client';

export type ContainerBillingContext = {
  tamanho?: string | null;
  tipo?: string | null;
  refrigerado?: boolean;
};

export type BillingRuleEngineInput = {
  gateInAt: Date;
  asOf: Date;
  regras: RegraTarifaria[];
  container: ContainerBillingContext;
  /** Cobrar taxa de gate-in (uma vez por ciclo). */
  incluirGateIn?: boolean;
  /** Cobrar taxa de gate-out (fechamento). */
  incluirGateOut?: boolean;
  /** Quantidade de shifting extras no período. */
  shiftingExtras?: number;
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
  | 'valor'
  | 'diasFreeTime'
  | 'ativa'
  | 'nome'
>;

export type LegacyTarifaLike = {
  freeTimeDias: number;
  valorDiaria: number;
  valorServicosExtras?: number;
};
