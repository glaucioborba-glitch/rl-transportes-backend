import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FinalidadeAluguelSolicitacao, StatusSolicitacaoAluguel } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class CriarSolicitacaoAluguelDto {
  @ApiProperty({ enum: FinalidadeAluguelSolicitacao })
  @IsEnum(FinalidadeAluguelSolicitacao)
  finalidade!: FinalidadeAluguelSolicitacao;

  @ApiPropertyOptional({
    example: '2026-10-01',
    description: 'Coleta prevista (AAAA-MM-DD). Opcional; só auxilia a operação interna.',
  })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' && value.trim() === '' ? undefined : value))
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Informe a coleta prevista no formato AAAA-MM-DD.' })
  dataColeta?: string;

  @ApiPropertyOptional({
    example: '2026-10-15',
    description: 'Previsão de devolução (AAAA-MM-DD). Opcional.',
  })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' && value.trim() === '' ? undefined : value))
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Informe a previsão de devolução no formato AAAA-MM-DD.' })
  dataPrevistaDevolucao?: string;
}

export class ListarSolicitacoesAluguelQueryDto {
  @ApiPropertyOptional({ enum: StatusSolicitacaoAluguel })
  @IsOptional()
  @IsEnum(StatusSolicitacaoAluguel)
  status?: StatusSolicitacaoAluguel;
}

export class RejeitarSolicitacaoAluguelDto {
  @ApiProperty({ example: 'Sem unidade disponível no período' })
  @IsString()
  @MaxLength(500)
  motivo!: string;
}
