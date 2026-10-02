import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { TipoDocumentoTerceiro } from '@prisma/client';
import { ObjectStorageService } from '../common/storage/object-storage.service';
import { OCRService } from '../modules/ocr/ocr.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  extractPdfPlainText,
  parseDocumentoTerceiro,
  type TipoDocumentoTerceiroExtract,
} from './terceiro-documento-extract.util';
import { parseIndiceDocumento } from './terceiro-placas-carretas.util';

const DEFAULT_TENANT = 'default';
const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED = new Set(['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp']);

@Injectable()
export class CadastrosTerceirosDocumentosService {
  private readonly logger = new Logger(CadastrosTerceirosDocumentosService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: ObjectStorageService,
    private readonly ocr: OCRService,
  ) {}

  async extrair(params: {
    file: Express.Multer.File;
    tipo: string;
    terceiroId?: string;
    indice?: string | number;
  }) {
    const tipo = this.parseTipo(params.tipo);
    this.assertFile(params.file);
    if (params.terceiroId) await this.assertTerceiro(params.terceiroId);
    const indice =
      tipo === 'CRLV_CARRETA' || tipo === 'CRLV_CARRETA_02'
        ? (parseIndiceDocumento(params.indice) ?? (tipo === 'CRLV_CARRETA_02' ? 1 : 0))
        : null;

    const mime = params.file.mimetype || 'application/octet-stream';
    const texto = await this.lerTexto(params.file.buffer, mime);
    const parsed = parseDocumentoTerceiro(tipo as TipoDocumentoTerceiroExtract, texto);
    this.logger.log(
      `Documento terceiro extraído tipo=${tipo} mime=${mime} size=${params.file.size} campos=${parsed.campos}`,
    );

    const safeName = (params.file.originalname || 'documento').replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 180);
    const uploaded = await this.storage.upload({
      key: `cadastros/terceiros/${params.terceiroId ?? 'rascunho'}/${randomUUID()}_${safeName}`,
      body: params.file.buffer,
      contentType: mime,
    });

    const row = await this.prisma.cadastroTerceiroDocumento.create({
      data: {
        tenantId: DEFAULT_TENANT,
        terceiroId: params.terceiroId || null,
        tipo,
        indice,
        storageKey: uploaded.storageKey,
        originalName: safeName,
        mimeType: mime,
        sizeBytes: params.file.size,
        extraido: parsed.sugestoes,
      },
    });

    return {
      id: row.id,
      tipo: row.tipo,
      indice: row.indice,
      originalName: row.originalName,
      mimeType: row.mimeType,
      sizeBytes: row.sizeBytes,
      sugestoes: parsed.sugestoes,
      confianca: parsed.confianca,
      campos: parsed.campos,
    };
  }

  async baixar(id: string) {
    const row = await this.prisma.cadastroTerceiroDocumento.findFirst({
      where: { id, tenantId: DEFAULT_TENANT },
    });
    if (!row) throw new NotFoundException('Documento não encontrado.');
    const file = await this.storage.getBuffer(row.storageKey);
    return {
      buffer: file.buffer,
      mimeType: file.mimeType || row.mimeType,
      filename: row.originalName,
    };
  }

  async vincular(terceiroId: string, documentoIds: string[]) {
    const ids = [...new Set(documentoIds.filter(Boolean))];
    if (!ids.length) return;
    await this.prisma.cadastroTerceiroDocumento.updateMany({
      where: { id: { in: ids }, tenantId: DEFAULT_TENANT, terceiroId: null },
      data: { terceiroId },
    });
  }

  private async lerTexto(buffer: Buffer, mime: string): Promise<string> {
    const isPdf = mime === 'application/pdf' || buffer.subarray(0, 4).toString() === '%PDF';
    if (isPdf) {
      const local = extractPdfPlainText(buffer);
      if (local.trim().length >= 40) return local;
    }
    const vision = await this.ocr.extractDocumentText(buffer);
    if (vision.trim()) return vision;
    if (isPdf) return extractPdfPlainText(buffer);
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Tesseract = require('tesseract.js') as typeof import('tesseract.js');
      const { data } = await Tesseract.recognize(buffer, 'por+eng', { logger: () => undefined });
      return data.text ?? '';
    } catch {
      this.logger.warn('OCR de imagem indisponível para documento de terceiro.');
      return '';
    }
  }

  private assertFile(file?: Express.Multer.File) {
    if (!file?.buffer?.length) throw new BadRequestException('Anexe um PDF ou imagem do documento.');
    if (file.size > MAX_BYTES) throw new BadRequestException('Arquivo acima de 8 MB.');
    const mime = (file.mimetype || '').toLowerCase();
    if (mime && !ALLOWED.has(mime)) {
      throw new BadRequestException('Envie PDF, JPG ou PNG (CNH Digital ou CRLV-e).');
    }
  }

  private parseTipo(raw: string): TipoDocumentoTerceiro {
    const t = String(raw || '').toUpperCase();
    if (t === 'CNH' || t === 'CRLV_CAVALO' || t === 'CRLV_CARRETA' || t === 'CRLV_CARRETA_02') {
      return t;
    }
    throw new BadRequestException('Tipo de documento inválido.');
  }

  private async assertTerceiro(id: string) {
    const row = await this.prisma.cadastroTerceiro.findFirst({
      where: { id, tenantId: DEFAULT_TENANT, deletedAt: null },
    });
    if (!row) throw new NotFoundException('Terceiro não encontrado.');
  }
}
