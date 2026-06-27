import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { sanitizeDocumentoInput } from '../../common/utils/login-documento.util';

export class LoginDto {
  @ApiProperty({ example: '04252011000110', description: 'CPF ou CNPJ (somente dígitos após normalização no servidor)' })
  @Type(() => String)
  @Transform(({ obj }) => sanitizeDocumentoInput(obj?.documento ?? obj?.cpfCnpj ?? ''))
  @IsString()
  @MinLength(10)
  @MaxLength(14)
  documento!: string;

  /** Alias legado — normalizado para `documento` pelo pipe/DTO. */
  @ApiProperty({ required: false, example: '04252011000110' })
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
  @MaxLength(64)
  tenantId?: string;
}
