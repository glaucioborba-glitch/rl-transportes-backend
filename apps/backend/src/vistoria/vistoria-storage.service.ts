import { randomUUID } from 'crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const PREFIX = 'logistica/vistorias';

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 120) || 'foto.jpg';
}

@Injectable()
export class VistoriaStorageService {
  private readonly logger = new Logger(VistoriaStorageService.name);
  private s3: S3Client | null = null;
  private readonly bucket: string | undefined;
  private readonly publicBase: string | undefined;
  private readonly apiPublicBase: string | undefined;

  constructor(private readonly config: ConfigService) {
    this.bucket = this.config.get<string>('AWS_S3_BUCKET') ?? process.env.AWS_S3_BUCKET;
    this.publicBase =
      this.config.get<string>('STORAGE_PUBLIC_BASE_URL') ?? process.env.STORAGE_PUBLIC_BASE_URL;
    this.apiPublicBase =
      this.config.get<string>('API_PUBLIC_BASE_URL') ??
      process.env.API_PUBLIC_BASE_URL ??
      `http://localhost:${process.env.API_PORT ?? '3001'}`;
    const region = this.config.get<string>('AWS_REGION') ?? process.env.AWS_REGION ?? 'us-east-1';
    const endpoint = process.env.S3_ENDPOINT ?? process.env.R2_ENDPOINT;
    if (this.bucket && process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
      this.s3 = new S3Client({
        region,
        ...(endpoint ? { endpoint, forcePathStyle: true } : {}),
      });
    }
  }

  async persistPhoto(params: {
    solicitacaoId: string;
    vistoriaId: string;
    angulo: string;
    buffer: Buffer;
    mimeType: string;
  }): Promise<{ url: string; storageKey: string }> {
    const ext = params.mimeType.includes('png') ? 'png' : 'jpg';
    const safe = sanitizeFilename(`${params.angulo}.${ext}`);
    const key = `${PREFIX}/${params.solicitacaoId}/${params.vistoriaId}/${randomUUID()}_${safe}`;

    if (this.s3 && this.bucket) {
      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: params.buffer,
          ContentType: params.mimeType,
          ...(this.publicBase ? { ACL: 'public-read' as never } : {}),
        }),
      );
      const url = this.publicBase
        ? `${this.publicBase.replace(/\/$/, '')}/${key}`
        : `https://${this.bucket}.s3.amazonaws.com/${key}`;
      this.logger.log(`Vistoria foto S3/R2 ${key}`);
      return { url, storageKey: key };
    }

    const relDir = path.join(params.solicitacaoId, params.vistoriaId);
    const base = path.join(process.cwd(), 'uploads', 'vistorias', relDir);
    fs.mkdirSync(base, { recursive: true });
    const file = `${randomUUID()}_${safe}`;
    fs.writeFileSync(path.join(base, file), params.buffer);
    const storageKey = `${relDir}/${file}`;
    const apiBase = this.apiPublicBase ?? `http://localhost:${process.env.API_PORT ?? '3001'}`;
    const url = `${apiBase.replace(/\/$/, '')}/v2/gate/vistoria/media/${encodeURIComponent(storageKey)}`;
    this.logger.warn(`Vistoria foto local: ${storageKey}`);
    return { url, storageKey };
  }

  readLocalFile(storageKey: string): { buffer: Buffer; mimeType: string } {
    const full = path.join(process.cwd(), 'uploads', 'vistorias', storageKey);
    if (!fs.existsSync(full)) throw new NotFoundException('Arquivo não encontrado');
    const mimeType = full.endsWith('.png') ? 'image/png' : 'image/jpeg';
    return { buffer: fs.readFileSync(full), mimeType };
  }

  async deleteObjects(storageKeys: string[]): Promise<void> {
    for (const key of storageKeys) {
      if (this.s3 && this.bucket && !key.includes('..')) {
        try {
          await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
        } catch (e) {
          this.logger.warn(`Falha ao remover S3 ${key}: ${(e as Error).message}`);
        }
        continue;
      }
      const full = path.join(process.cwd(), 'uploads', 'vistorias', key);
      try {
        fs.unlinkSync(full);
      } catch {
        /* ignore */
      }
    }
  }
}
