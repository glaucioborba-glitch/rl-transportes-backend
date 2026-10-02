import { IsString, MinLength } from 'class-validator';

export class LiberarMotoristaExternoDto {
  @IsString()
  @MinLength(5)
  documento!: string;

  @IsString()
  @MinLength(1)
  password!: string;
}
