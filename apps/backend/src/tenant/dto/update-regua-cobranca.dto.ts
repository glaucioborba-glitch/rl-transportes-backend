import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

class ReguaEtapasDto {
  @IsOptional()
  @IsBoolean()
  preVencimento?: boolean;

  @IsOptional()
  @IsBoolean()
  vencimentoHoje?: boolean;

  @IsOptional()
  @IsBoolean()
  atrasoLeve?: boolean;

  @IsOptional()
  @IsBoolean()
  preBloqueio?: boolean;
}

export class UpdateReguaCobrancaDto {
  @IsOptional()
  @IsBoolean()
  ativo?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(30)
  diasPreVencimento?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(90)
  diasAtrasoLeve?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(30)
  diasPreBloqueio?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => ReguaEtapasDto)
  etapas?: ReguaEtapasDto;
}
