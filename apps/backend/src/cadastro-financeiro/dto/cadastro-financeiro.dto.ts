import { IsIn, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class AprovarCadastroFinanceiroDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  condicaoPagamento!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  prazoPagamento!: string;
}

export class AtualizarCondicaoClienteDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  condicaoPagamento!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  prazoPagamento!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  cadastroTabelaPrecoId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  cadastroTabelaTransporteId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  cadastroTabelaServicoId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  cadastroTabelaAluguelId?: string;

  @IsOptional()
  @IsIn(['MANUAL', 'AUTOMATICO'])
  faturamentoModo?: 'MANUAL' | 'AUTOMATICO';

  @IsOptional()
  @IsString()
  @Matches(/^$|^([01]\d|2[0-3]):[0-5]\d$/, { message: 'Informe a hora no formato HH:mm.' })
  faturamentoHora?: string;
}

export class RejeitarCadastroFinanceiroDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  motivo!: string;
}
