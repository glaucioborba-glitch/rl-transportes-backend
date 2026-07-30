import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { OCRRequest } from './ocr-provider.interface';
import { OCRService } from './ocr.service';

type ProcessarBody = OCRRequest & { esperado?: string };

@ApiTags('ocr')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('jwt'), RolesGuard, PermissionsGuard)
@Controller('v2/ocr')
export class OCRController {
  constructor(private readonly ocrService: OCRService) {}

  @Post('processar')
  @HttpCode(200)
  @Roles(Role.ADMIN, Role.GERENTE, Role.OPERADOR_PORTARIA, Role.OPERADOR_GATE)
  @Permissions('solicitacoes:portaria')
  @ApiOperation({ summary: 'Processar OCR de contêiner ou placa' })
  async processar(@Body() body: ProcessarBody) {
    if (!body.imagem) {
      return {
        sucesso: false,
        erro: 'Imagem é obrigatória',
        texto: '',
        confianca: 0,
        ocrMatch: false,
      };
    }

    if (body.tipo !== 'CONTAINER' && body.tipo !== 'PLACA') {
      return {
        sucesso: false,
        erro: 'Tipo deve ser CONTAINER ou PLACA',
        texto: '',
        confianca: 0,
        ocrMatch: false,
      };
    }

    const resultado = await this.ocrService.processar({
      imagem: body.imagem,
      tipo: body.tipo,
      valorEsperado: body.valorEsperado ?? body.esperado,
    });

    return {
      sucesso: resultado.sucesso,
      texto: resultado.textoExtraido,
      textoBruto: resultado.textoBruto,
      confianca: resultado.confianca,
      provider: resultado.provider,
      ocrMatch: resultado.ocrMatch,
      erro: resultado.erro,
    };
  }

  @Get('status')
  @Roles(Role.ADMIN, Role.GERENTE, Role.OPERADOR_PORTARIA, Role.OPERADOR_GATE)
  @Permissions('solicitacoes:ler')
  status() {
    return {
      googleVision: this.ocrService.isGoogleVisionAvailable(),
      tesseract: true,
    };
  }
}
