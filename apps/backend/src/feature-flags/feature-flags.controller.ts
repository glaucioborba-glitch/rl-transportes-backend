import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { UpdateFeatureFlagDto } from './dto/update-feature-flag.dto';
import { FeatureFlagService } from './feature-flag.service';

@ApiTags('admin-feature-flags')
@ApiBearerAuth('access-token')
@Controller('admin/feature-flags')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(Role.ADMIN)
export class FeatureFlagsController {
  constructor(private readonly flags: FeatureFlagService) {}

  @Get()
  @ApiOperation({ summary: 'Lista toggles (painel diretoria / canary)' })
  list() {
    return this.flags.listAll();
  }

  @Patch(':chave')
  @ApiOperation({ summary: 'Atualiza toggle — invalida cache Redis' })
  update(@Param('chave') chave: string, @Body() dto: UpdateFeatureFlagDto) {
    return this.flags.upsert(chave, {
      ativo: dto.ativo,
      regras: {
        cnpjAllowList: dto.cnpjAllowList,
        tenantIds: dto.tenantIds,
      },
      descricao: dto.descricao,
    });
  }
}
