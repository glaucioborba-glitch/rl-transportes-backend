import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { sanitizeDocumentoInput } from '../../common/utils/login-documento.util';

export class PortalLoginDto {
  @ApiProperty({ description: 'CPF ou CNPJ do usuário' })
  @Type(() => String)
  @Transform(({ value }) => sanitizeDocumentoInput(value))
  @IsString()
  @MinLength(10)
  @MaxLength(14)
  documento!: string;

  @ApiProperty()
  @IsString()
  @MinLength(4)
  password!: string;

  @ApiPropertyOptional({ enum: ['CLIENTE', 'FORNECEDOR', 'PARCEIRO'] })
  @IsOptional()
  @IsIn(['CLIENTE', 'FORNECEDOR', 'PARCEIRO'])
  papel?: 'CLIENTE' | 'FORNECEDOR' | 'PARCEIRO';

  @ApiPropertyOptional({ example: 'default', description: 'Tenant lógico (alternativa: header X-Tenant-Id)' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  tenantId?: string;
}
