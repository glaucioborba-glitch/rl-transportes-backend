import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class AuthResetPasswordDto {
  @ApiProperty({ description: 'Token recebido por e-mail' })
  @IsString()
  @MinLength(10)
  @MaxLength(200)
  token!: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  newPassword!: string;
}
