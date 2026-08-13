import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdatePessoaAutorizadaDto {
  @ApiPropertyOptional({ description: 'Ativar ou desativar pessoa autorizada' })
  @IsOptional()
  @IsBoolean()
  ativo?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @ApiPropertyOptional({ description: 'Telefone (apenas dígitos ou formatado)' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  telefone?: string;
}
