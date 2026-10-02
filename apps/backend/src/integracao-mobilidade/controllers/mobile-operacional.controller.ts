import { Controller, Get, GoneException, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';

/** Legado `/mobile/*` (JWT staff). App atual: `/mobile/v1`. */
@ApiTags('integracao-mobile-deprecated')
@Public()
@Controller('mobile')
export class MobileOperacionalController {
  private gone(): never {
    throw new GoneException('API /mobile descontinuada. Use /mobile/v1.');
  }

  @Post('portaria')
  @HttpCode(HttpStatus.GONE)
  @ApiOperation({ deprecated: true, summary: 'Removido — use /mobile/v1' })
  portaria() {
    this.gone();
  }

  @Post('gate')
  @HttpCode(HttpStatus.GONE)
  @ApiOperation({ deprecated: true, summary: 'Removido — use /mobile/v1' })
  gate() {
    this.gone();
  }

  @Post('patio')
  @HttpCode(HttpStatus.GONE)
  @ApiOperation({ deprecated: true, summary: 'Removido — use /mobile/v1' })
  patio() {
    this.gone();
  }

  @Post('saida')
  @HttpCode(HttpStatus.GONE)
  @ApiOperation({ deprecated: true, summary: 'Removido — use /mobile/v1' })
  saida() {
    this.gone();
  }

  @Get('minhas-operacoes')
  @ApiOperation({ deprecated: true, summary: 'Removido — use /mobile/v1' })
  minhas() {
    this.gone();
  }

  @Get('turno')
  @ApiOperation({ deprecated: true, summary: 'Removido — use /mobile/v1' })
  turno() {
    this.gone();
  }
}
