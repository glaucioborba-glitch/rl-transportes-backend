import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class IniciarAluguelDto {
  @ApiProperty()
  @IsUUID()
  unidadeAluguelId!: string;

  @ApiProperty()
  @IsUUID()
  clienteId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  tabelaAluguelId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  observacao?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  solicitacaoAluguelId?: string;
}
