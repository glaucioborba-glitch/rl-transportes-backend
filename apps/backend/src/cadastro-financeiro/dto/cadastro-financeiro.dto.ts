import { IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

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
  @IsUUID()
  cadastroTabelaPrecoId?: string;

  @IsOptional()
  @IsUUID()
  cadastroTabelaTransporteId?: string;
}

export class RejeitarCadastroFinanceiroDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  motivo!: string;
}
