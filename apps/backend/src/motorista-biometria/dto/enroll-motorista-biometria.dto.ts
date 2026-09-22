import { IsString, MinLength } from 'class-validator';

export class EnrollMotoristaBiometriaDto {
  @IsString()
  @MinLength(32)
  firText!: string;
}
