import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { CepCacheService } from './cep-cache.service';

@ApiTags('metrics')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('metrics')
export class CepCacheController {
  constructor(private readonly cepCache: CepCacheService) {}

  @Get('cep-cache')
  @Roles(Role.ADMIN, Role.GERENTE, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Métricas do cache CEP (hits, miss, falhas ViaCEP, TTL)' })
  metrics() {
    return this.cepCache.getMetrics();
  }
}
