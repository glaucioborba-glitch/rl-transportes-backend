import { ArrayMinSize, IsArray, IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

const LAT_MS = [200, 500, 1500, 5000] as const;

export class ChaosLatenciaDto {
  @IsIn([...LAT_MS])
  ms!: (typeof LAT_MS)[number];

  @IsArray()
  @ArrayMinSize(1)
  @IsIn(['security', 'agendamentos', 'solicitacoes'], { each: true })
  targets!: Array<'security' | 'agendamentos' | 'solicitacoes'>;

  @IsOptional()
  @IsInt()
  @Min(500)
  @Max(30_000)
  durationMs?: number;
}
