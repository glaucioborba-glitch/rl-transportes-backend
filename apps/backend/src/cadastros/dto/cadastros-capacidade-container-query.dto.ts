import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CadastrosCapacidadeContainerQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;
}
