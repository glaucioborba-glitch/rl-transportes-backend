import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEmail,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CadastrosColaboradorFormDto {
  @ApiProperty()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  nome!: string;

  @ApiProperty()
  @Transform(({ value }) => (typeof value === 'string' ? value.replace(/\D/g, '') : value))
  @IsString()
  @Matches(/^\d{11}$/, { message: 'CPF deve ter 11 dígitos.' })
  cpf!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(32)
  matricula?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  rg?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.replace(/\D/g, '') : value))
  @IsString()
  pis?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dataNascimento?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsIn(['M', 'F', 'O', ''])
  sexo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  estadoCivil?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nacionalidade?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cep?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  endereco?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  numero?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  complemento?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bairro?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cidade?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  uf?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  telefone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  celular?: string;

  @ApiProperty()
  @IsDateString()
  dataAdmissao!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cargo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  departamento?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  gestorId?: string;

  @ApiPropertyOptional({ default: 'CLT' })
  @IsOptional()
  @IsIn(['CLT', 'TERCEIRIZADO', 'ESTAGIARIO', 'TEMPORARIO', 'PRESTADOR'])
  vinculo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  regimeTrabalho?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  jornadaSemanal?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  turno?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  centroCustoId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  salario?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contaBancaria?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cnhNumero?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cnhCategoria?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  cnhValidade?: string;

  @ApiPropertyOptional({ default: 'ATIVO' })
  @IsOptional()
  @IsIn(['ATIVO', 'AFASTADO', 'FERIAS', 'INATIVO'])
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dataDemissao?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  motivoDemissao?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  observacoes?: string;
}
