import { Controller, Get, NotFoundException, Param, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { EmpresaOperadoraService } from './empresa-operadora.service';
import { DEFAULT_TENANT_ID } from './tenant.constants';

@ApiTags('public')
@Public()
@Controller('public/empresa')
export class EmpresaPublicController {
  constructor(private readonly empresa: EmpresaOperadoraService) {}

  @Get('branding')
  @ApiOperation({ summary: 'Nome e URLs das logos da empresa (login, portais, intranet)' })
  branding() {
    return this.empresa.brandingPublico(DEFAULT_TENANT_ID);
  }

  @Get('logo/:slot')
  @ApiOperation({ summary: 'Arquivo da logo da empresa (com fallback entre slots)' })
  async logo(@Param('slot') slot: string, @Res() res: Response) {
    try {
      const file = await this.empresa.lerLogo(DEFAULT_TENANT_ID, slot);
      res.setHeader('Content-Type', file.mimeType);
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.setHeader('Content-Disposition', `inline; filename="${file.filename}"`);
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      res.send(file.buffer);
    } catch {
      throw new NotFoundException();
    }
  }

  @Get('cliente-logo/:clienteId')
  @ApiOperation({ summary: 'Logo do cliente no portal' })
  async clienteLogo(@Param('clienteId') clienteId: string, @Res() res: Response) {
    try {
      const file = await this.empresa.lerClienteLogo(DEFAULT_TENANT_ID, clienteId);
      res.setHeader('Content-Type', file.mimeType);
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.setHeader('Content-Disposition', `inline; filename="${file.filename}"`);
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      res.send(file.buffer);
    } catch {
      throw new NotFoundException();
    }
  }
}
