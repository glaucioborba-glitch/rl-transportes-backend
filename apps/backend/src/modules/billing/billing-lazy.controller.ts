import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { BillingLazyLoaderService } from './billing-lazy-loader.service';

@ApiTags('admin-platform')
@ApiBearerAuth('access-token')
@Controller('admin/platform')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(Role.ADMIN)
export class BillingLazyController {
  constructor(private readonly loader: BillingLazyLoaderService) {}

  @Get('billing-lazy/status')
  @ApiOperation({ summary: 'Status do lazy-load de CRONs de faturamento' })
  status() {
    return this.loader.status();
  }

  @Post('billing-lazy/warmup')
  @ApiOperation({ summary: 'Força carregamento dos CRONs de armazenagem/billing' })
  async warmup() {
    await this.loader.ensureLoaded();
    return this.loader.status();
  }
}
