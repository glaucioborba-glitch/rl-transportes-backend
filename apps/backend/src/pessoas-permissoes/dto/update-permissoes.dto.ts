import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class PermissoesPessoaInputDto {
  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  podeCriarSolicitacao?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  podeAnexarDocumentos?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  podeAgendarTurno?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  podeVisualizarFinanceiro?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  podeAprovarOS?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  podeVerOS?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  podeAlterarDadosGate?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  podeGerarPDF?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  podeGerenciarPessoas?: boolean;
}

export class UpdatePermissoesPessoaDto extends PermissoesPessoaInputDto {}
