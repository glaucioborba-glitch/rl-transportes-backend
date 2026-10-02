import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class StaffRejeitarV2Dto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  motivo?: string;
}
