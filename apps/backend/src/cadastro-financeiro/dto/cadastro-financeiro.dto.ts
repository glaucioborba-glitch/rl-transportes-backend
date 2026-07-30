import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class AprovarCadastroFinanceiroDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  condicaoPagamento!: string;
}

export class RejeitarCadastroFinanceiroDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  motivo!: string;
}
