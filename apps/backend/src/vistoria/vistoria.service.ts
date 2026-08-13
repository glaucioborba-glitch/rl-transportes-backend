import { BadRequestException, Injectable } from '@nestjs/common';
import {
  AnguloFotoVistoria,
  Prisma,
  TipoVistoria,
  type FotoVistoria,
  type Vistoria,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { VistoriaStorageService } from './vistoria-storage.service';

export const ANGULOS_OBRIGATORIOS: AnguloFotoVistoria[] = [
  AnguloFotoVistoria.FRENTE,
  AnguloFotoVistoria.TRASEIRA,
  AnguloFotoVistoria.LATERAL_DIREITA,
  AnguloFotoVistoria.LATERAL_ESQUERDA,
];

export type VistoriaPhotoUpload = {
  angulo: AnguloFotoVistoria;
  buffer: Buffer;
  mimeType: string;
};

@Injectable()
export class VistoriaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: VistoriaStorageService,
  ) {}

  assertFotosCompletas(fotos: Map<AnguloFotoVistoria, VistoriaPhotoUpload>): void {
    const missing = ANGULOS_OBRIGATORIOS.filter((a) => !fotos.has(a));
    if (missing.length) {
      throw new BadRequestException(
        `Fotos obrigatórias ausentes: ${missing.join(', ')}. Capture as 4 faces do contêiner.`,
      );
    }
  }

  parseFotosFromMultipart(
    files: Partial<Record<string, Express.Multer.File[]>>,
  ): Map<AnguloFotoVistoria, VistoriaPhotoUpload> {
    const map = new Map<AnguloFotoVistoria, VistoriaPhotoUpload>();
    for (const angulo of ANGULOS_OBRIGATORIOS) {
      const key = `foto_${angulo}`;
      const file = files[key]?.[0];
      if (!file?.buffer?.length) continue;
      if (!file.mimetype?.startsWith('image/')) {
        throw new BadRequestException(`Arquivo ${angulo} deve ser imagem`);
      }
      map.set(angulo, {
        angulo,
        buffer: file.buffer,
        mimeType: file.mimetype,
      });
    }
    return map;
  }

  async createVistoria(
    tx: Prisma.TransactionClient,
    params: {
      solicitacaoId: string;
      tipo: TipoVistoria;
      avarias?: string[];
      gateCheckInId?: string;
      gateCheckOutId?: string;
      fotos: Map<AnguloFotoVistoria, VistoriaPhotoUpload>;
    },
  ): Promise<{ vistoria: Vistoria; fotos: FotoVistoria[]; publicUrls: string[] }> {
    this.assertFotosCompletas(params.fotos);

    const vistoria = await tx.vistoria.create({
      data: {
        solicitacaoId: params.solicitacaoId,
        tipo: params.tipo,
        avarias: (params.avarias ?? []) as unknown as Prisma.InputJsonValue,
        gateCheckInId: params.gateCheckInId ?? null,
        gateCheckOutId: params.gateCheckOutId ?? null,
      },
    });

    const uploadedKeys: string[] = [];
    const publicUrls: string[] = [];
    const fotoRows: FotoVistoria[] = [];

    try {
      for (const angulo of ANGULOS_OBRIGATORIOS) {
        const shot = params.fotos.get(angulo)!;
        const stored = await this.storage.persistPhoto({
          solicitacaoId: params.solicitacaoId,
          vistoriaId: vistoria.id,
          angulo,
          buffer: shot.buffer,
          mimeType: shot.mimeType,
        });
        uploadedKeys.push(stored.storageKey);
        publicUrls.push(stored.url);
        const row = await tx.fotoVistoria.create({
          data: {
            vistoriaId: vistoria.id,
            angulo,
            url: stored.url,
            storageKey: stored.storageKey,
          },
        });
        fotoRows.push(row);
      }
    } catch (err) {
      await this.storage.deleteObjects(uploadedKeys);
      throw err;
    }

    return { vistoria, fotos: fotoRows, publicUrls };
  }

  async listBySolicitacao(solicitacaoId: string) {
    const rows = await this.prisma.vistoria.findMany({
      where: { solicitacaoId },
      orderBy: { criadoEm: 'asc' },
      include: { fotos: { orderBy: { angulo: 'asc' } } },
    });
    return rows.map((v) => ({
      id: v.id,
      tipo: v.tipo,
      criadoEm: v.criadoEm.toISOString(),
      avarias: Array.isArray(v.avarias) ? (v.avarias as string[]) : [],
      fotos: v.fotos.map((f) => ({
        id: f.id,
        angulo: f.angulo,
        url: f.url,
      })),
    }));
  }

  async rollbackUploaded(storageKeys: string[]) {
    await this.storage.deleteObjects(storageKeys);
  }
}
