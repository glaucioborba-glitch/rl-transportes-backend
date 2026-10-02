import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateTransportadoraAutorizadaDto {
  @ApiProperty({ example: '11222333000181' })
  @IsString()
  @MinLength(14)
  @MaxLength(18)
  cnpj!: string;

  @ApiProperty({ example: 'Transportes Rápido Sul LTDA' })
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  razaoSocial!: string;

  @ApiProperty({ example: 'operacao@transportadora.com.br' })
  @IsEmail()
  @MaxLength(255)
  emailContato!: string;

  @ApiProperty({ minLength: 8, description: 'Senha inicial de acesso (login com CNPJ)' })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;
}
