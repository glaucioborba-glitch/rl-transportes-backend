import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { PortalIdentityService } from './portal-identity.service';

class PortalLoginDto {
  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsString()
  @MinLength(4)
  password: string;

  @ApiProperty({ required: false, enum: ['CLIENTE', 'FORNECEDOR', 'PARCEIRO'] })
  @IsOptional()
  @IsIn(['CLIENTE', 'FORNECEDOR', 'PARCEIRO'])
  papel?: 'CLIENTE' | 'FORNECEDOR' | 'PARCEIRO';

  @ApiProperty({ required: false, description: 'Tenant lógico (multi-terminal Fase 18)', example: 'default' })
  @IsOptional()
  @IsString()
  tenantId?: string;
}

class PortalRefreshDto {
  @ApiProperty()
  @IsString()
  refreshToken: string;
}

class Portal2faDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  code?: string;
}

@ApiTags('cx-portal-iam')
@Controller('portal')
export class PortalIdentityController {
  constructor(private readonly identity: PortalIdentityService) {}

  @Post('login')
  @ApiOperation({
    summary: 'Login IAM portal (JWT híbrido)',
    description:
      '**CLIENTE:** usuário Prisma `Role.CLIENTE`. **FORNECEDOR/PARCEIRO:** seed em memória `CX_PORTAL_FORNECEDOR_SEED`. Chaves públicas Fase 18 **não** autenticam aqui.',
  })
  async login(@Body() body: PortalLoginDto) {
    return this.identity.login(body.email, body.password, body.papel, body.tenantId);
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Refresh token portal (par de tokens dedicados)' })
  async refresh(@Body() body: PortalRefreshDto) {
    return this.identity.refresh(body.refreshToken);
  }

  @Post('2fa')
  @ApiOperation({ summary: '2FA opcional (stub nesta fase)' })
  async twoFa(@Body() body: Portal2faDto) {
    return this.identity.twoFaStub(body);
  }
}
