import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreatePatioDto {
  @ApiProperty()
  @IsUUID()
  solicitacaoId!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  quadra!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  fileira!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  posicao!: string;
}
