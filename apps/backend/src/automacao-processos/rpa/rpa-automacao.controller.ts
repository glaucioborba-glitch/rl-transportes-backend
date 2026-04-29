import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { BadRequestException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RpaAutomacaoService } from './rpa-automacao.service';
import { RpaRunDto } from '../dto/rpa-automacao.dto';

@ApiTags('automacao-rpa')
@ApiBearerAuth('access-token')
@Controller('automacao/rpa')
@UseGuards(AuthGuard('jwt'), RolesGuard, PermissionsGuard)
@Roles(Role.ADMIN, Role.GERENTE, Role.OPERADOR_PORTARIA, Role.OPERADOR_GATE, Role.OPERADOR_PATIO)
export class RpaAutomacaoController {
  constructor(private readonly rpa: RpaAutomacaoService) {}

  @Get('jobs')
  @ApiOperation({ summary: 'Listar jobs RPA recentes' })
  @Permissions('automacao:read')
  jobs() {
    return this.rpa.listarJobs();
  }

  @Post('jobs/run')
  @ApiOperation({ summary: 'Agendar execução de robô interno (assíncrono)' })
  @Permissions('automacao:rpa:run')
  run(@Body() body: RpaRunDto) {
    try {
      return this.rpa.agendarExecucao(body.robotId);
    } catch {
      throw new BadRequestException('robot_invalido');
    }
  }
}
