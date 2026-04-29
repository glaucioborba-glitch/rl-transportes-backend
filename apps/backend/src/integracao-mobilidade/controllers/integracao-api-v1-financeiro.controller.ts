import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiExtraModels,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import type { Request } from 'express';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { envelopeV1 } from '../common/integracao-response.helper';
import { ApiEnvelopeDto } from '../dto/integracao-envelope.dto';
import { IntegracaoApiGatewayService } from '../services/integracao-api-gateway.service';

@ApiTags('integracao-api-gateway')
@ApiBearerAuth('access-token')
@ApiExtraModels(ApiEnvelopeDto)
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(Role.ADMIN, Role.GERENTE)
@Controller('api/v1/financeiro')
export class IntegracaoApiV1FinanceiroController {
  constructor(private readonly gateway: IntegracaoApiGatewayService) {}

  @Get('resumo')
  @ApiOperation({ summary: 'Resumo financeiro (read-only)' })
  @ApiOkResponse({ schema: { allOf: [{ $ref: getSchemaPath(ApiEnvelopeDto) }] } })
  async resumo(@Req() req: Request) {
    const data = await this.gateway.financeiroResumo();
    return envelopeV1(data, req.headers['x-request-id'] as string | undefined);
  }
}
