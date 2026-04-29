import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import type { Express } from 'express';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import {
  IaCicloPrevistoQueryDto,
  IaOcrGateBodyDto,
  IaProdutividadeOperadorQueryDto,
} from './dto/ia-query.dto';
import {
  IaCicloPrevistoRespostaDto,
  IaGargalosRespostaDto,
  IaOcrGateRespostaDto,
  IaPatioRecomendacoesRespostaDto,
  IaProdutividadeOperadorRespostaDto,
} from './dto/ia-response.dto';
import { IaOperacionalService } from './ia-operacional.service';

/** Gestão: todas previsões. Operadores: apenas OCR + recomendações de pátio (somente leitura auxiliar). */
const IA_STAFF = [Role.ADMIN, Role.GERENTE];
const IA_OCR_PATIO = [
  Role.ADMIN,
  Role.GERENTE,
  Role.OPERADOR_GATE,
  Role.OPERADOR_PORTARIA,
  Role.OPERADOR_PATIO,
];

@ApiTags('ia-operacional')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('ia')
export class IaOperacionalController {
  constructor(private readonly iaOperacionalService: IaOperacionalService) {}

  @Get('gargalos')
  @Roles(...IA_STAFF)
  @ApiOperation({
    summary: 'Previsão de gargalos por etapa (2h, 4h, 8h)',
    description:
      'Calcula probabilidades por horizonte com base em tempos de fila históricos Portaria→Gate→Pátio→Saída. Inclui confiança, tendência e nota de sazonalidade.',
  })
  @ApiOkResponse({ type: IaGargalosRespostaDto })
  getGargalos(): Promise<IaGargalosRespostaDto> {
    return this.iaOperacionalService.getGargalos();
  }

  @HttpCode(HttpStatus.OK)
  @Post('ocr/gate')
  @Roles(...IA_OCR_PATIO)
  @ApiConsumes('application/json')
  @ApiOperation({
    summary: 'OCR auxiliar no Gate — JSON base64 (protótipo mock)',
    description:
      'Corpo JSON `{ imagemBase64 }`. Para arquivo binário use `POST /ia/ocr/gate/upload`. Pipeline mock extrai texto determinístico e valida Mercosul / ISO 6346.',
  })
  @ApiBody({ type: IaOcrGateBodyDto })
  @ApiOkResponse({ type: IaOcrGateRespostaDto })
  async ocrGateJson(@Body() body: IaOcrGateBodyDto): Promise<IaOcrGateRespostaDto> {
    const buffer = IaOperacionalService.decodeBase64ParaBuffer(body.imagemBase64);
    return this.iaOperacionalService.processarImagemOcr(buffer);
  }

  @HttpCode(HttpStatus.OK)
  @Post('ocr/gate/upload')
  @Roles(...IA_OCR_PATIO)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'OCR auxiliar no Gate — multipart (protótipo mock)',
    description:
      'Campo de formulário `imagem` (PNG/JPEG). Mesmo motor que `/ia/ocr/gate` em JSON.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        imagem: { type: 'string', format: 'binary', description: 'PNG ou JPEG' },
      },
      required: ['imagem'],
    },
  })
  @ApiOkResponse({ type: IaOcrGateRespostaDto })
  @UseInterceptors(
    FileInterceptor('imagem', {
      storage: memoryStorage(),
      limits: { fileSize: 6 * 1024 * 1024 },
    }),
  )
  async ocrGateUpload(@UploadedFile() arquivo: Express.Multer.File | undefined): Promise<IaOcrGateRespostaDto> {
    if (!arquivo?.buffer?.length) {
      throw new BadRequestException('Envie o arquivo no campo imagem (multipart/form-data)');
    }
    return this.iaOperacionalService.processarImagemOcr(arquivo.buffer);
  }

  @Get('ciclo-previsto')
  @Roles(...IA_STAFF)
  @ApiOperation({
    summary: 'Previsão de ciclo total (minutos)',
    description:
      'Regressão leve: média móvel sobre ciclo histórico (Portaria→Saída), bandas pelo desvio padrão e ajuste por horário de chegada.',
  })
  @ApiOkResponse({ type: IaCicloPrevistoRespostaDto })
  getCicloPrevisto(@Query() query: IaCicloPrevistoQueryDto): Promise<IaCicloPrevistoRespostaDto> {
    return this.iaOperacionalService.getCicloPrevisto(query);
  }

  @Get('patio/recomendacoes')
  @Roles(...IA_OCR_PATIO)
  @ApiOperation({
    summary: 'Hotspots e sugestões de balanceamento no pátio',
    description:
      'Somente recomendações; não altera posicionamentos. Ocupação por quadra, hotspots e pares origem→destino.',
  })
  @ApiOkResponse({ type: IaPatioRecomendacoesRespostaDto })
  getPatioRecomendacoes(): Promise<IaPatioRecomendacoesRespostaDto> {
    return this.iaOperacionalService.getPatioRecomendacoes();
  }

  @Get('produtividade-operador')
  @Roles(...IA_STAFF)
  @ApiOperation({
    summary: 'Produtividade previsional por turno',
    description:
      'Agrega auditorias INSERT em portarias/gates/patios/saídas no turno (±21 dias), projeta ops/h e lista outliers por usuário.',
  })
  @ApiOkResponse({ type: IaProdutividadeOperadorRespostaDto })
  getProdutividadeOperador(
    @Query() query: IaProdutividadeOperadorQueryDto,
  ): Promise<IaProdutividadeOperadorRespostaDto> {
    return this.iaOperacionalService.getProdutividadeOperador(query);
  }
}
