import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString } from 'class-validator';

export class CadastrosEquipamentoQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    enum: ['todos', 'disponiveis', 'em_uso', 'manutencao', 'inativos'],
    default: 'todos',
  })
  @IsOptional()
  @IsIn(['todos', 'disponiveis', 'em_uso', 'manutencao', 'inativos'])
  status?: 'todos' | 'disponiveis' | 'em_uso' | 'manutencao' | 'inativos';
}
