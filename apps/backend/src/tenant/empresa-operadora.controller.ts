import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { memoryStorage } from 'multer';
import type { Request } from 'express';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { UpdateEmpresaOperadoraDto } from './dto/update-empresa-operadora.dto';
import { SimularEncargosDto } from './dto/simular-encargos.dto';
import { EmpresaOperadoraService } from './empresa-operadora.service';
import { DEFAULT_TENANT_ID } from './tenant.constants';

const EMPRESA_ROLES: Role[] = [Role.ADMIN, Role.GERENTE];

@ApiTags('cadastros')
@ApiBearerAuth('access-token')
@Controller('v2/cadastros/empresa')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class EmpresaOperadoraController {
  constructor(private readonly empresa: EmpresaOperadoraService) {}

  @Get()
  @Roles(...EMPRESA_ROLES)
  @ApiOperation({ summary: 'Cadastro da empresa operadora (tenant)' })
  obter(@Req() req: Request & { tenantId?: string; user?: { tenantId?: string } }) {
    return this.empresa.obter(req.tenantId ?? req.user?.tenantId ?? DEFAULT_TENANT_ID);
  }

  @Patch()
  @Roles(...EMPRESA_ROLES)
  @ApiOperation({ summary: 'Atualizar dados da empresa operadora' })
  atualizar(
    @Req() req: Request & { tenantId?: string; user?: { tenantId?: string } },
    @Body() dto: UpdateEmpresaOperadoraDto,
  ) {
    return this.empresa.atualizar(req.tenantId ?? req.user?.tenantId ?? DEFAULT_TENANT_ID, dto);
  }

  @Get('encargos')
  @Roles(...EMPRESA_ROLES)
  @ApiOperation({ summary: 'Provisões de encargos já gravadas (não são títulos a pagar)' })
  listarEncargos(@Req() req: Request & { tenantId?: string; user?: { tenantId?: string } }) {
    return this.empresa.listarEncargos(req.tenantId ?? req.user?.tenantId ?? DEFAULT_TENANT_ID);
  }

  @Post('encargos/simular')
  @Roles(...EMPRESA_ROLES)
  @ApiOperation({ summary: 'Simula ISS/PIS/COFINS/CSLL/IRPJ ou DAS sobre a receita do período' })
  simularEncargos(
    @Req() req: Request & { tenantId?: string; user?: { tenantId?: string } },
    @Body() dto: SimularEncargosDto,
  ) {
    return this.empresa.simularEncargos(req.tenantId ?? req.user?.tenantId ?? DEFAULT_TENANT_ID, dto);
  }

  @Post('encargos/gerar-agora')
  @Roles(...EMPRESA_ROLES)
  @ApiOperation({
    summary: 'Gera prévia do mês corrente com as faturas já emitidas (não espera o dia 1)',
  })
  gerarAgora(@Req() req: Request & { tenantId?: string; user?: { tenantId?: string } }) {
    return this.empresa.gerarPreviaMesCorrente(req.tenantId ?? req.user?.tenantId ?? DEFAULT_TENANT_ID);
  }

  @Post('logos/:slot')
  @Roles(...EMPRESA_ROLES)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('arquivo', { storage: memoryStorage(), limits: { fileSize: 600 * 1024 } }))
  @ApiOperation({ summary: 'Enviar logo da empresa (ícone, horizontal, portal, documento ou e-mail)' })
  uploadLogo(
    @Req() req: Request & { tenantId?: string; user?: { tenantId?: string } },
    @Param('slot') slot: string,
    @UploadedFile() arquivo?: Express.Multer.File,
  ) {
    return this.empresa.uploadLogo(req.tenantId ?? req.user?.tenantId ?? DEFAULT_TENANT_ID, slot, arquivo);
  }

  @Delete('logos/:slot')
  @Roles(...EMPRESA_ROLES)
  removerLogo(
    @Req() req: Request & { tenantId?: string; user?: { tenantId?: string } },
    @Param('slot') slot: string,
  ) {
    return this.empresa.removerLogo(req.tenantId ?? req.user?.tenantId ?? DEFAULT_TENANT_ID, slot);
  }

  @Get('clientes/:clienteId/logo')
  @Roles(...EMPRESA_ROLES)
  clienteLogo(
    @Req() req: Request & { tenantId?: string; user?: { tenantId?: string } },
    @Param('clienteId') clienteId: string,
  ) {
    return this.empresa.obterClienteLogoMeta(
      req.tenantId ?? req.user?.tenantId ?? DEFAULT_TENANT_ID,
      clienteId,
    );
  }

  @Post('clientes/:clienteId/logo')
  @Roles(...EMPRESA_ROLES)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('arquivo', { storage: memoryStorage(), limits: { fileSize: 500 * 1024 } }))
  uploadClienteLogo(
    @Req() req: Request & { tenantId?: string; user?: { tenantId?: string } },
    @Param('clienteId') clienteId: string,
    @UploadedFile() arquivo?: Express.Multer.File,
  ) {
    return this.empresa.uploadClienteLogo(
      req.tenantId ?? req.user?.tenantId ?? DEFAULT_TENANT_ID,
      clienteId,
      arquivo,
    );
  }

  @Delete('clientes/:clienteId/logo')
  @Roles(...EMPRESA_ROLES)
  removerClienteLogo(
    @Req() req: Request & { tenantId?: string; user?: { tenantId?: string } },
    @Param('clienteId') clienteId: string,
  ) {
    return this.empresa.removerClienteLogo(
      req.tenantId ?? req.user?.tenantId ?? DEFAULT_TENANT_ID,
      clienteId,
    );
  }
}
