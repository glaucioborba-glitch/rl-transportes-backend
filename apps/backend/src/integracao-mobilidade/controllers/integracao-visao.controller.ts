import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { OcrCameraDto, OcrGateDto } from '../dto/integracao-visao.dto';
import { IntegracaoVisaoService } from '../services/integracao-visao.service';

@ApiTags('integracao-visao')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(Role.ADMIN, Role.GERENTE)
@Controller('integracao/ocr')
export class IntegracaoVisaoController {
  constructor(private readonly visao: IntegracaoVisaoService) {}

  @Post('camera')
  @ApiOperation({
    summary: 'Ingresso OCR externo (camera)',
    description: 'Normaliza placas e emite evento ocr.normalizado para o barramento.',
  })
  camera(@Body() dto: OcrCameraDto) {
    return this.visao.ingestCamera(dto);
  }

  @Post('gate')
  @ApiOperation({
    summary: 'Ingresso OCR focado no gate',
    description: 'Emite evento gate.registrado.',
  })
  gate(@Body() dto: OcrGateDto) {
    return this.visao.ingestGate(dto);
  }
}
