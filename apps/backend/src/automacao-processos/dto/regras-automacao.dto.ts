import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';

export class CriarRegraDto {
  @ApiProperty()
  @IsString()
  nome: string;

  @ApiProperty({ enum: ['operacional', 'fiscal', 'financeiro', 'rh', 'compliance'] })
  @IsString()
  @IsIn(['operacional', 'fiscal', 'financeiro', 'rh', 'compliance'])
  tipo: 'operacional' | 'fiscal' | 'financeiro' | 'rh' | 'compliance';

  @ApiProperty({
    description: 'Expressão simples: `campo>10`, `campo>=3`, `container.tipo=reefer`',
    example: 'container.stay_hours>72',
  })
  @IsString()
  if: string;

  @ApiProperty({
    example: 'alerta + auditoria + workflow:uuid-do-workflow',
    description: 'Texto com tokens: alerta, auditoria, workflow:<id>',
  })
  @IsString()
  then: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  else?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}
