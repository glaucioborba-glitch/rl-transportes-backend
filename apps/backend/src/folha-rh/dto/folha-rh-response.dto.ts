import { ApiProperty } from '@nestjs/swagger';

export class ColaboradorRhRespostaDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  nome!: string;

  @ApiProperty()
  cpf!: string;

  @ApiProperty()
  cargo!: string;

  @ApiProperty()
  turno!: string;

  @ApiProperty()
  salarioBase!: number;

  @ApiProperty()
  tipoContratacao!: string;

  @ApiProperty()
  dataAdmissao!: string;

  @ApiProperty({ required: false })
  dataDemissao?: string;

  @ApiProperty({ type: [String] })
  beneficiosAtivos!: string[];

  @ApiProperty()
  createdAt!: string;
}

export class BeneficioRhRespostaDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  nomeBeneficio!: string;

  @ApiProperty()
  valorMensal!: number;

  @ApiProperty()
  tipoBeneficio!: string;

  @ApiProperty()
  createdAt!: string;
}

export class PresencaRhRespostaDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  colaboradorId!: string;

  @ApiProperty()
  data!: string;

  @ApiProperty()
  horasTrabalhadas!: number;

  @ApiProperty()
  horasExtras!: number;

  @ApiProperty()
  adicionalNoturnoHoras!: number;

  @ApiProperty()
  falta!: boolean;

  @ApiProperty()
  createdAt!: string;
}

export class LinhaColaboradorCalculoDto {
  @ApiProperty()
  colaboradorId!: string;

  @ApiProperty()
  nome!: string;

  @ApiProperty()
  turno!: string;

  @ApiProperty()
  salarioBase!: number;

  @ApiProperty({ description: 'Salário proporcional aos dias úteis sem falta (presenças)' })
  salarioProporcional!: number;

  @ApiProperty()
  valorHorasExtras50!: number;

  @ApiProperty()
  valorHorasExtras100!: number;

  @ApiProperty()
  valorHorasExtrasTotal!: number;

  @ApiProperty()
  valorAdicionalNoturno!: number;

  @ApiProperty({ description: 'DSR reflexo sobre HE proporcional a domingos/feriados' })
  valorDsr!: number;

  @ApiProperty()
  beneficiosEmpresa!: number;

  @ApiProperty()
  descontoBeneficiosFolha!: number;

  @ApiProperty()
  baseBruta!: number;

  @ApiProperty()
  inssFuncionario!: number;

  @ApiProperty({ description: 'FGTS 8% patronal (base bruta remuneratória)' })
  fgtsPatronal!: number;

  @ApiProperty({ description: 'Proxy patronal (INSS patronal, SAT, terceiros — env FOLHA_ENCARGOS_PATRONAIS_PCT)' })
  encargosPatronaisValor!: number;

  @ApiProperty({ description: 'Provisão 1/12 férias sobre salário contratual' })
  provisaoFerias!: number;

  @ApiProperty({ description: 'Provisão 1/12 décimo terceiro' })
  provisaoDecimoTerceiro!: number;

  @ApiProperty()
  salarioLiquido!: number;

  @ApiProperty()
  custoTotalEmpresa!: number;
}

export class CalculoFolhaRespostaDto {
  @ApiProperty()
  mes!: string;

  @ApiProperty({ description: 'Soma salários líquidos no período' })
  salarioLiquidoTotal!: number;

  @ApiProperty()
  custoTotalEmpresa!: number;

  @ApiProperty({ description: 'FGTS + encargos patronais proxy' })
  encargosTotal!: number;

  @ApiProperty()
  beneficiosEmpresaTotal!: number;

  @ApiProperty()
  provisoesTotal!: number;

  @ApiProperty({ type: [LinhaColaboradorCalculoDto] })
  porColaborador!: LinhaColaboradorCalculoDto[];
}

export class CustoTurnoDetalheDto {
  @ApiProperty()
  custoTotal!: number;

  @ApiProperty()
  headcount!: number;

  @ApiProperty()
  custoMedio!: number;
}

export class CustosTurnoRespostaDto {
  @ApiProperty()
  mes!: string;

  @ApiProperty()
  custoTotalTurno!: Record<string, CustoTurnoDetalheDto>;

  @ApiProperty({
    description:
      'Distribuição igualitária do custo do turno entre “operações” simuladas (proxy — não altera simulador-terminal)',
  })
  custoPorOperacao!: Record<string, number>;

  @ApiProperty({
    description:
      'Indicador unitário: menor valor = melhor eficiência nominal (custo / headcount normalizado)',
  })
  impactoProdutividade!: Record<string, number>;
}

export class MesValorRhDto {
  @ApiProperty()
  mes!: string;

  @ApiProperty()
  valor!: number;
}

export class ProjecaoAnualRhRespostaDto {
  @ApiProperty({ type: [MesValorRhDto] })
  custoFolha12Meses!: MesValorRhDto[];

  @ApiProperty({ type: [MesValorRhDto] })
  custoBeneficios12Meses!: MesValorRhDto[];

  @ApiProperty({ type: [MesValorRhDto] })
  custoProvisoes12Meses!: MesValorRhDto[];

  @ApiProperty({ description: 'Admissões previstas no ano (proxy FOLHA_PREVISAO_ADMISSOES_ANO)' })
  previsaoContratacoes!: number;

  @ApiProperty({
    description:
      'Caixa acumulado estimado após folha anual vs saldo proxy FINANCEIRO_SALDO_CONTA_PROXY (Fase 9)',
  })
  impactoFuturoCaixaEstimado!: number;
}

export class DashboardFolhaRhDto {
  @ApiProperty()
  headcountAtivo!: number;

  @ApiProperty()
  custoMedioPorColaborador!: number;

  @ApiProperty({ description: 'Custo empresa total competência corrente (usa mês atual se não informado)' })
  totalFolhaMes!: number;

  @ApiProperty()
  totalEncargos!: number;

  @ApiProperty({ description: 'Faltas / (headcount × dias úteis)' })
  absentismoPct!: number;

  @ApiProperty({ description: 'Proxy anual (FOLHA_TURNOVER_PROXY_PCT)' })
  turnoverProxyPct!: number;

  @ApiProperty({
    description: 'Eficiência por turno: 1 / (1 + custoMédioTurno / média global)',
  })
  eficienciaPorTurno!: Record<string, number>;
}
