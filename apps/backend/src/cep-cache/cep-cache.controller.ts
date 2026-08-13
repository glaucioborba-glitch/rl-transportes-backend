import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CepCacheService } from './cep-cache.service';

@ApiTags('metrics')
@Controller('metrics')
export class CepCacheController {
  constructor(private readonly cepCache: CepCacheService) {}

  @Get('cep-cache')
  @ApiOperation({ summary: 'Métricas do cache CEP (hits, miss, falhas ViaCEP, TTL)' })
  metrics() {
    return this.cepCache.getMetrics();
  }
}
