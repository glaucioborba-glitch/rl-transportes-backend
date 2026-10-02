import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { CadastrosBancosService } from './cadastros-bancos.service';
import { CadastrosBancoFormDto } from './dto/cadastros-banco-form.dto';

const CADASTROS_ROLES = [Role.ADMIN, Role.GERENTE] as const;

@ApiTags('cadastros')
@ApiBearerAuth('access-token')
@Controller('v2/cadastros/bancos')
@UseGuards(AuthGuard('jwt'), RolesGuard, PermissionsGuard)
@Roles(...CADASTROS_ROLES)
export class CadastrosBancosController {
  constructor(private readonly service: CadastrosBancosService) {}

  @Get()
  list(@Query('search') search?: string) {
    return this.service.list(search);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CadastrosBancoFormDto) {
    return this.service.create(dto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: CadastrosBancoFormDto) {
    return this.service.update(id, dto);
  }
}
