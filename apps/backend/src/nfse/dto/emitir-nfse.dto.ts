import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class RpsNfseDto {
  @ApiProperty({ example: '225' })
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  nroReciboProvisorio!: string;

  @ApiProperty({ example: 'RPS' })
  @IsString()
  @MinLength(1)
  @MaxLength(10)
  serieReciboProvisorio!: string;

  @ApiProperty({ description: 'Data dd/mm/aaaa' })
  @IsString()
  @MinLength(8)
  @MaxLength(10)
  dataEmissao!: string;

  @ApiProperty({ description: 'Hora HH:mm:ss' })
  @IsString()
  @MinLength(6)
  @MaxLength(8)
  horaEmissao!: string;
}

export class ServicoNfseDto {
  @ApiProperty({ example: '8221', description: 'Código TOM do local da prestação' })
  @IsString()
  @MinLength(1)
  @MaxLength(9)
  codigoLocalPrestacao!: string;

  @ApiProperty({ example: '4930201' })
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  codigoAtividade!: string;

  @ApiProperty({ example: '160201' })
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  codigoItemListaServico!: string;

  @ApiProperty({ description: 'Descritivo com múltiplas linhas (itens operacionais).' })
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  descritivo!: string;

  @ApiProperty({ description: 'Alíquota % (ex.: 2 para 2%)' })
  @IsNumber()
  aliquotaPercent!: number;

  @ApiProperty({ example: '0' })
  @IsString()
  @MaxLength(4)
  situacaoTributaria!: string;

  @ApiProperty({ description: 'Deve conferir com o valor total do faturamento (centavos).' })
  @IsNumber()
  valorTributavel!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  valorDeducao?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  valorIssrf?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  valorDescontoIncondicional?: number;

  @ApiProperty({ enum: ['S', 'N'] })
  @IsString()
  tributaMunicipioPrestador!: 'S' | 'N';

  @ApiProperty({ enum: ['S', 'N'] })
  @IsString()
  tributaMunicipioTomador!: 'S' | 'N';
}

export class TomadorNfseDto {
  @ApiProperty({ enum: ['J', 'F', 'E'] })
  @IsString()
  tipo!: 'J' | 'F' | 'E';

  @ApiProperty()
  @IsString()
  @MinLength(11)
  @MaxLength(14)
  cpfcnpj!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(16)
  ie?: string;

  @ApiProperty()
  @IsString()
  @MaxLength(200)
  nomeRazaoSocial!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(200)
  sobrenomeNomeFantasia!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(8)
  numeroResidencia!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  complemento?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  pontoReferencia?: string;

  @ApiProperty()
  @IsString()
  @MaxLength(60)
  pais!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(2)
  siglaPais!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(4)
  codigoIbgePais!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(2)
  estado!: string;

  @ApiProperty({ description: 'Código TOM do município do endereço' })
  @IsString()
  @MaxLength(9)
  cidadeTom!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(70)
  logradouro!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(30)
  bairro!: string;

  @ApiProperty({ description: 'Somente dígitos' })
  @IsString()
  @MinLength(8)
  @MaxLength(8)
  cep!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(3)
  dddFoneResidencial?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(3)
  dddFoneComercial?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(11)
  foneResidencial?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(11)
  foneComercial?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(3)
  dddFax?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(11)
  foneFax?: string;

  @ApiProperty()
  @IsString()
  @MaxLength(200)
  email!: string;
}

export class EmitirNfseDto {
  @ApiProperty({ type: () => RpsNfseDto })
  @ValidateNested()
  @Type(() => RpsNfseDto)
  rps!: RpsNfseDto;

  @ApiProperty({ type: () => ServicoNfseDto })
  @ValidateNested()
  @Type(() => ServicoNfseDto)
  servico!: ServicoNfseDto;

  @ApiProperty({ type: () => TomadorNfseDto })
  @ValidateNested()
  @Type(() => TomadorNfseDto)
  tomador!: TomadorNfseDto;

  @ApiPropertyOptional({ description: 'Data fato dd/mm/aaaa (padrão: mesma do RPS).' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  dataFato?: string;

  @ApiPropertyOptional({ description: 'Observação na NF; use "0" se não houver.' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  observacao?: string;

  @ApiPropertyOptional({ description: 'Idempotência do arquivo (NTE-35).' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  identificadorArquivo?: string;

  @ApiPropertyOptional({ description: 'NTE-35 §4.8 — valida XML sem emitir.' })
  @IsOptional()
  @IsBoolean()
  modoTeste?: boolean;
}
