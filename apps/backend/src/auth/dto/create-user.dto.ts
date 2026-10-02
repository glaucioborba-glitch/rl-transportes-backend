import { ApiProperty } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { IsEmail, IsEnum, IsString, Length, MinLength } from 'class-validator';

export class CreateUserDto {
  @ApiProperty({ description: 'CPF ou CNPJ (14 dígitos no banco; CPF com zeros à esquerda)' })
  @IsString()
  @Length(14, 14)
  cpfCnpj!: string;

  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiProperty({ enum: Role })
  @IsEnum(Role)
  role!: Role;
}
