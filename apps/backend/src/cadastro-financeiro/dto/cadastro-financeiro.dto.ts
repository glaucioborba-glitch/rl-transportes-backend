import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

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
}

export class RejeitarCadastroFinanceiroDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  motivo!: string;
}
