import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class RefreshDto {
  @ApiProperty({ required: false, description: 'Obrigatório exceto quando refresh HttpOnly em cookie (rl_rt).' })
  @IsOptional()
  @IsString()
  @MinLength(10)
  refreshToken?: string;
}
