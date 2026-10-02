import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength, ValidateNested } from 'class-validator';
import { IsCpfDigits } from '../../common/validators/is-cpf-digits.validator';
import { PermissoesPessoaInputDto } from '../../pessoas-permissoes/dto/update-permissoes.dto';

export class CreatePessoaAutorizadaDto {
  @ApiProperty()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  nome!: string;

  @ApiProperty()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail()
  email!: string;

  @ApiProperty({ description: 'CPF (11 dígitos, com ou sem máscara)' })
  @Transform(({ value }) => (typeof value === 'string' ? value.replace(/\D/g, '') : value))
  @IsString()
  @IsCpfDigits()
  cpf!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.replace(/\D/g, '') : value))
  @IsString()
  @Matches(/^\d{10,11}$/, { message: 'Telefone inválido (DDD + número, 10 ou 11 dígitos).' })
  telefone?: string;

  @ApiProperty({ required: false, type: PermissoesPessoaInputDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => PermissoesPessoaInputDto)
  permissoes?: PermissoesPessoaInputDto;
}
