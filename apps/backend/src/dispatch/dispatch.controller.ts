import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { memoryStorage } from 'multer';
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { DispatchService } from './dispatch.service';
import { AssignDispatchDto } from './dto/assign-dispatch.dto';
import { UpdateOrdemStatusDto } from './dto/update-ordem-status.dto';

const DISPATCH_ROLES: Role[] = [Role.ADMIN, Role.GERENTE, Role.OPERADOR_GATE, Role.OPERADOR_PATIO];

function staffGuards() {
  return [AuthGuard('jwt'), RolesGuard, PermissionsGuard] as const;
}

@ApiTags('dispatch')
@ApiBearerAuth('access-token')
@Controller('dispatch')
export class DispatchController {
  constructor(private readonly dispatch: DispatchService) {}

  @Get('pendentes')
  @UseGuards(...staffGuards())
  @Roles(...DISPATCH_ROLES)
  @Permissions('dispatch:ler')
  @ApiOperation({ summary: 'Agendamentos FROTA_FL sem ordem de transporte' })
  pendentes() {
    return this.dispatch.listarPendentes();
  }

  @Get('board')
  @UseGuards(...staffGuards())
  @Roles(...DISPATCH_ROLES)
  @Permissions('dispatch:ler')
  @ApiOperation({ summary: 'Kanban — backlog + motoristas com OT ativa' })
  board() {
    return this.dispatch.board();
  }

  @Get('veiculos')
  @UseGuards(...staffGuards())
  @Roles(...DISPATCH_ROLES)
  @Permissions('dispatch:ler')
  veiculos() {
    return this.dispatch.listarVeiculos();
  }

  @Post('assign')
  @UseGuards(...staffGuards())
  @Roles(...DISPATCH_ROLES)
  @Permissions('dispatch:operar')
  @ApiOperation({ summary: 'Despachar agendamento para motorista + veículo' })
  assign(@Body() dto: AssignDispatchDto, @CurrentUser() user: AuthUser) {
    return this.dispatch.assign(dto, user.sub);
  }

  @Get('motorista/viagem-ativa')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'OT ativa do motorista logado (app campo)' })
  viagemAtiva(@CurrentUser() user: AuthUser) {
    return this.dispatch.viagemAtivaMotorista(user.sub);
  }

  @Patch('ordem/:id/status')
  @UseGuards(AuthGuard('jwt'))
  @ApiConsumes('multipart/form-data', 'application/json')
  @UseInterceptors(
    FileInterceptor('podFoto', {
      storage: memoryStorage(),
      limits: { fileSize: 8 * 1024 * 1024 },
    }),
  )
  @ApiOperation({ summary: 'Atualiza status da OT (coordenador ou motorista)' })
  atualizarStatus(
    @Param('id') id: string,
    @Body() dto: UpdateOrdemStatusDto,
    @CurrentUser() user: AuthUser,
    @UploadedFile() podFoto?: Express.Multer.File,
  ) {
    const isDispatchStaff = user.permissions?.includes('dispatch:operar') ?? false;
    return this.dispatch.atualizarStatus(id, dto, user.sub, {
      motoristaUsuarioId: isDispatchStaff ? undefined : user.sub,
      podFile: podFoto,
    });
  }
}
