import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AnalyticsLazyLoaderService } from './analytics-lazy-loader.service';

@ApiTags('admin-platform')
@ApiBearerAuth('access-token')
@Controller('admin/platform')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(Role.ADMIN)
export class AnalyticsLazyController {
  constructor(private readonly loader: AnalyticsLazyLoaderService) {}

  @Get('analytics-lazy/status')
  @ApiOperation({ summary: 'Status do lazy-load de módulos BI' })
  status() {
    return this.loader.status();
  }

  @Post('analytics-lazy/warmup')
  @ApiOperation({ summary: 'Força carregamento do bundle Analytics (BI)' })
  async warmup() {
    await this.loader.ensureLoaded();
    return this.loader.status();
  }
}
