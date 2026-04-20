import {
  IsString,
  IsEmail,
  IsEnum,
  IsOptional,
  MaxLength,
  MinLength,
  Matches,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { TipoCliente } from '@prisma/client';

export class CreateClienteDto {
  @ApiProperty({
    example: 'Empresa XYZ Ltda',
    description: 'Nome completo da empresa ou pessoa',
  })
  @IsString()
  @MaxLength(255)
  @MinLength(3)
  nome: string;

  @ApiProperty({
    enum: TipoCliente,
    example: 'PJ',
    description: 'Tipo: PJ (Pessoa Jurídica) ou PF (Pessoa Física)',
  })
  @IsEnum(TipoCliente)
  tipo: TipoCliente;

  @ApiProperty({
    example: '12345678000195',
    description: 'CPF (11 dígitos) ou CNPJ (14 dígitos), apenas números',
  })
  @IsString()
  @Matches(/^\d{11}$|^\d{14}$/, {
    message:
      'CPF deve ter 11 dígitos ou CNPJ deve ter 14 dígitos (somente números)',
  })
  cpfCnpj: string;

  @ApiProperty({
    example: 'contato@empresa.com',
    description: 'E-mail válido para contato',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: '4733334444',
    description: 'Telefone com DDD (10-11 dígitos)',
  })
  @IsString()
  @IsOptional()
  @Matches(/^(\+55)?\d{10,11}$/, {
    message: 'Telefone inválido (formato: 4733334444 ou +5547333334444)',
  })
  telefone?: string;

  @ApiProperty({
    example: 'Rua A, 123 - Bairro - SC',
    description: 'Endereço completo',
  })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  @MinLength(3)
  endereco?: string;
}