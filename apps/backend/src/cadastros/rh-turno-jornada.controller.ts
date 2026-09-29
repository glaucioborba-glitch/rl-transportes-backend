import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RhTurnoJornadaFormDto } from './dto/rh-turno-jornada-form.dto';
import { RhTurnoJornadaService } from './rh-turno-jornada.service';

const RH_ROLES = [Role.ADMIN, Role.GERENTE, Role.SUPER_ADMIN] as const;

@ApiTags('rh')
@ApiBearerAuth('access-token')
@Controller('v2/rh/turnos-jornada')
@UseGuards(AuthGuard('jwt'), RolesGuard, PermissionsGuard)
@Roles(...RH_ROLES)
export class RhTurnoJornadaController {
  constructor(private readonly service: RhTurnoJornadaService) {}

  @Get()
  @ApiOperation({ summary: 'Turnos de jornada da equipe (RH)' })
  list() {
    return this.service.list();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: RhTurnoJornadaFormDto) {
    return this.service.create(dto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: RhTurnoJornadaFormDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
