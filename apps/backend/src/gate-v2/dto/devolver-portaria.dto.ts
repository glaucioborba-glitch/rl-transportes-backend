import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsOptional, IsString } from 'class-validator';
import { MOTIVOS_DEVOLVER_PORTARIA, type MotivoDevolverPortaria } from '../conferencia-entrada-saida.util';

export class DevolverPortariaDto {
  @IsOptional()
  @IsIn(MOTIVOS_DEVOLVER_PORTARIA)
  motivo?: MotivoDevolverPortaria;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @IsString({ each: true })
  fotosRefazer!: string[];
}
