import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsOptional, IsString, Length, MinLength } from 'class-validator';
import { sanitizeDocumentoInput } from '../../common/utils/login-documento.util';

export class LoginDto {
  @ApiProperty({
    example: '52998224725',
    description: 'CPF do funcionário (11 dígitos, somente números após normalização)',
  })
  @Type(() => String)
  @Transform(({ obj }) => sanitizeDocumentoInput(obj?.documento ?? obj?.cpf ?? obj?.cpfCnpj ?? ''))
  @IsString()
  @Length(11, 11, { message: 'CPF deve conter exatamente 11 dígitos' })
  documento!: string;

  /** Alias API — normalizado para `documento`. */
  @ApiProperty({ required: false, example: '52998224725' })
  @IsOptional()
  @IsString()
  cpf?: string;

  /** Alias legado — normalizado para `documento` pelo pipe/DTO. */
  @ApiProperty({ required: false, example: '52998224725' })
  @IsOptional()
  @IsString()
  cpfCnpj?: string;

  @ApiProperty({ example: 'Admin@123' })
  @IsString()
  @MinLength(1)
  password!: string;

  @ApiProperty({
    required: false,
    example: 'default',
    description: 'Tenant lógico (alternativa: header X-Tenant-Id). Obrigatório em SaaS multi-tenant.',
  })
  @IsOptional()
  @IsString()
  @Length(1, 64)
  tenantId?: string;
}
