import {
  Controller,
  Get,
  Param,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { PdfOperacionalV2Service } from './pdf-operacional-v2.service';
import { PdfSolicitacaoV2AccessGuard } from './pdf-solicitacao-v2-access.guard';
import { PessoaPermissoesGuard } from '../common/guards/pessoa-permissoes.guard';
import { PessoaPode } from '../common/decorators/pessoa-pode.decorator';

@ApiTags('solicitacoes-v2-pdf')
@ApiBearerAuth('access-token')
@Controller('v2/solicitacoes')
export class PdfOperacionalV2Controller {
  constructor(private readonly pdf: PdfOperacionalV2Service) {}

  @Get(':id/pdf')
  @UseGuards(PdfSolicitacaoV2AccessGuard, PessoaPermissoesGuard)
  @PessoaPode('gerarPDF')
  @ApiOperation({ summary: 'PDF operacional A4 (Portal dono ou Staff autorizado)' })
  async downloadPdf(
    @Param('id') id: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const buf = await this.pdf.getPdfBuffer(id, req);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="solicitacao-v2-${id}.pdf"`);
    res.send(buf);
  }

  @Get(':id/verificar')
  @ApiOperation({
    summary: 'Verificar autenticidade do PDF (hash) — público',
    description: 'Usado pelo QRCode; não exige autenticação.',
  })
  async verificar(@Param('id') id: string, @Query('hash') hash: string) {
    return this.pdf.verificarAuthenticidade(id, hash ?? '');
  }
}
