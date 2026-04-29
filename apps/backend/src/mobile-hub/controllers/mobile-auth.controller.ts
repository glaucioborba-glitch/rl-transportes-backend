import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { IsEmail, IsIn, IsString, MinLength } from 'class-validator';
import { MobileIdentityService } from '../identity/mobile-identity.service';
import type { MobileRole } from '../types/mobile-hub.types';

class MobileLoginDto {
  @ApiProperty()
  @IsEmail()
  email: string;

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
  login(@Body() body: MobileLoginDto) {
    return this.identity.login(body.email, body.password, body.deviceId, body.mobileRole);
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Refresh token mobile' })
  refresh(@Body() body: MobileRefreshDto) {
    return this.identity.refresh(body.refreshToken);
  }
}
