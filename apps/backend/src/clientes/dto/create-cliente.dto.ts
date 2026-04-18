import { ApiProperty } from '@nestjs/swagger';
import { TipoCliente } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEmail, IsEnum, IsString, MaxLength, MinLength } from 'class-validator';
import { onlyDigits } from '../../common/utils/br-documents';
import { IsCpfCnpj } from '../../common/validators/is-cpf-cnpj.validator';

export class CreateClienteDto {
  @ApiProperty({ maxLength: 255 })
  @IsString()
  @MaxLength(255)
  nome!: string;

  @ApiProperty({ enum: TipoCliente })
  @IsEnum(TipoCliente)
  tipo!: TipoCliente;

  @ApiProperty({ description: 'CPF (PF) ou CNPJ (PJ), com ou sem formatação' })
  @Transform(({ value }) => (typeof value === 'string' ? onlyDigits(value) : value))
  @IsString()
  @IsCpfCnpj()
  cpfCnpj!: string;

  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  @MaxLength(20)
  telefone!: string;

  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  endereco!: string;
}
