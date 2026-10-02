import { IsString, Matches, MaxLength } from 'class-validator';

export class FeriadoMunicipalDto {
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  data!: string;

  @IsString()
  @MaxLength(120)
  nome!: string;
}
