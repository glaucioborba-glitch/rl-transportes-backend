import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString } from 'class-validator';
import { IsCpfDigits } from '../../common/validators/is-cpf-digits.validator';

export class ValidarPessoaDto {
  @ApiProperty({ example: '52998224725', description: 'CPF (11 dígitos, com ou sem máscara)' })
  @Transform(({ value }) => (typeof value === 'string' ? value.replace(/\D/g, '') : value))
  @IsNotEmpty({ message: 'CPF é obrigatório.' })
  @IsString()
  @IsCpfDigits()
  cpf!: string;
}
