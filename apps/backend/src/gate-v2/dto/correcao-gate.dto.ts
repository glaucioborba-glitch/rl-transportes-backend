import { ArrayMaxSize, IsArray, IsOptional, IsString, MaxLength } from 'class-validator';

export class CorrecaoGateDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  container?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  tipo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  tamanho?: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  situacao?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  lacre?: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  placaCavalo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  placaCarreta?: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  placaCarreta02?: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  tipoCaminhao?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  motorista?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  cpf?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  transportadora?: string;

  /** ID do cadastro MDM (`cadastros_transportadoras`). Vazio limpa o campo. */
  @IsOptional()
  @IsString()
  @MaxLength(36)
  transportadoraId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  observacao?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(20)
  confirmar?: string[];

  /** Token curto emitido após CPF+senha de gerente (edição pós-RIC). */
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  gerenteToken?: string;

  /** Obrigatório na edição após a RIC. */
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  motivo?: string;
}
