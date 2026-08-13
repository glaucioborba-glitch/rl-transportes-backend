import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CargoFuncionario, Role, StatusFuncionario } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { CreateFuncionarioDto } from './dto/create-funcionario.dto';
import { UpdateFuncionarioDto } from './dto/update-funcionario.dto';
import { UpsertEscalasDto } from './dto/upsert-escalas.dto';
import { WorkforceRhService } from './workforce-rh.service';

const RH_ROLES = [Role.ADMIN, Role.GERENTE];

@ApiTags('workforce-rh')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(...RH_ROLES)
@Controller('workforce-rh')
export class WorkforceRhController {
  constructor(private readonly service: WorkforceRhService) {}

  @Get('funcionarios')
  @ApiOperation({ summary: 'Listar funcionários operacionais' })
  listFuncionarios(
    @Query('status') status?: StatusFuncionario,
    @Query('cargo') cargo?: CargoFuncionario,
  ) {
    return this.service.listFuncionarios({ status, cargo });
  }

  @Post('funcionarios')
  @HttpCode(HttpStatus.CREATED)
  createFuncionario(@Body() dto: CreateFuncionarioDto) {
    return this.service.createFuncionario(dto);
  }

  @Patch('funcionarios/:id')
  updateFuncionario(@Param('id') id: string, @Body() dto: UpdateFuncionarioDto) {
    return this.service.updateFuncionario(id, dto);
  }

  @Post('funcionarios/:id/inativar')
  @HttpCode(HttpStatus.OK)
  inativarFuncionario(@Param('id') id: string) {
    return this.service.inativarFuncionario(id);
  }

  @Get('escalas')
  listEscalas(@Query('dataInicio') dataInicio: string, @Query('dataFim') dataFim: string) {
    return this.service.listEscalas(dataInicio, dataFim);
  }

  @Post('escalas')
  upsertEscalas(@Body() dto: UpsertEscalasDto) {
    return this.service.upsertEscalas(dto);
  }
}
