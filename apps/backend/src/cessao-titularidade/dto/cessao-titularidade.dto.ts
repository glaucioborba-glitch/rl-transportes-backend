import {
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CessaoAutorizacaoGerenteDto {
  @IsString()
  @MinLength(11)
  @MaxLength(18)
  documento!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(128)
  password!: string;
}

export class ExecutarCessaoDto {
  @IsUUID()
  paraClienteId!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(2000)
  motivo!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  gerenteToken?: string;
}

export class ConfirmarReemissaoCessaoDto {
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(2000)
  observacao?: string;
}
