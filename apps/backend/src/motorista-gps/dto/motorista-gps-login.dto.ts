import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length, Matches } from 'class-validator';

export class MotoristaGpsLoginDto {
  @ApiProperty({ example: '123.456.789-09' })
  @IsString()
  @Length(11, 18)
  cpf!: string;

  @ApiProperty({ example: '8909', description: '4 últimos dígitos do CPF' })
  @IsString()
  @Matches(/^\d{4}$/, { message: 'PIN deve ter 4 dígitos' })
  pin!: string;
}
