import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CepResponseDto {
  @ApiProperty({ example: true })
  cepValido!: boolean;

  @ApiProperty({ example: '88010000' })
  cep!: string;

  @ApiPropertyOptional({ nullable: true })
  logradouro!: string | null;

  @ApiPropertyOptional({ nullable: true })
  bairro!: string | null;

  @ApiPropertyOptional({ nullable: true })
  cidade!: string | null;

  @ApiPropertyOptional({ nullable: true })
  uf!: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'Código IBGE do município (7 dígitos)' })
  ibge!: string | null;

  @ApiPropertyOptional({
    description: 'Mensagem opcional para o front quando a validação automática falhou',
  })
  aviso?: string | null;

  @ApiPropertyOptional({ description: 'Resposta servida do Redis' })
  fromCache?: boolean;
}

export type CepCacheMetricsSnapshot = {
  hits: number;
  miss: number;
  fail: number;
  invalidFormat: number;
  ttlSeconds: number;
  ttlMediaSegundos: number;
};
