import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class AutorizacaoGerenteDto {
  @IsString()
  @MinLength(11)
  @MaxLength(18)
  documento!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(128)
  password!: string;
}

export class ExcluirRicDto {
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  gerenteToken?: string;

  @IsOptional()
  @IsString()
  @MinLength(11)
  @MaxLength(18)
  documento?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  password?: string;
}
