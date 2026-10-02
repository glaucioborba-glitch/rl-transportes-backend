import { Body, Controller, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';
import { MobileIdentityService } from '../identity/mobile-identity.service';
import type { MobileRole } from '../types/mobile-hub.types';
import { LoginDocumentoPipe } from '../../common/pipes/login-documento.pipe';
import { sanitizeDocumentoInput } from '../../common/utils/login-documento.util';

class MobileLoginDto {
  @ApiProperty({ description: 'CPF ou CNPJ' })
  @Type(() => String)
  @Transform(({ value }) => sanitizeDocumentoInput(value))
  @IsString()
  @MinLength(10)
  @MaxLength(14)
  documento: string;

  @ApiProperty()
  @IsString()
  @MinLength(4)
  password: string;

  @ApiProperty({ description: 'Identificador único do aparelho', minLength: 4 })
  @IsString()
  @MinLength(4)
  deviceId: string;

  @ApiProperty({ enum: ['OPERADOR_MOBILE', 'MOTORISTA', 'CLIENTE_APP'] })
  @IsIn(['OPERADOR_MOBILE', 'MOTORISTA', 'CLIENTE_APP'])
  mobileRole: MobileRole;
}

class MobileRefreshDto {
  @ApiProperty()
  @IsString()
  refreshToken: string;
}

@ApiTags('mobile-hub-auth')
@Controller('mobile/v1/auth')
export class MobileAuthController {
  constructor(private readonly identity: MobileIdentityService) {}

  @Post('login')
  @ApiOperation({ summary: 'Login mobile (JWT dedicado + device binding)' })
  login(@Body(LoginDocumentoPipe) body: MobileLoginDto, @Req() req: Request) {
    return this.identity.login(body.documento, body.password, body.deviceId, body.mobileRole, req);
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Refresh token mobile' })
  refresh(@Body() body: MobileRefreshDto, @Req() req: Request) {
    return this.identity.refresh(body.refreshToken, req);
  }
}
