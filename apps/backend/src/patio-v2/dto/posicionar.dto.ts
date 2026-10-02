import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class PatioPosicionarDto {
  @ApiProperty({ description: 'ID da PatioUnidade' })
  @IsUUID()
  unidadeId!: string;

  @ApiProperty({ example: 'A01', description: 'Código da baia destino' })
  @IsString()
  @MaxLength(16)
  codigoBaia!: string;

  @ApiPropertyOptional({ enum: ['LIFT_ON', 'REPOSICIONAMENTO'] })
  @IsOptional()
  @IsIn(['LIFT_ON', 'REPOSICIONAMENTO'])
  tipo?: 'LIFT_ON' | 'REPOSICIONAMENTO';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  observacao?: string;
}

export class PatioPrepararGateOutDto {
  @ApiProperty()
  @IsUUID()
  solicitacaoId!: string;
}
